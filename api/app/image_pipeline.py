from dataclasses import dataclass
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageOps


WARP_WIDTH = 2400
WARP_HEIGHT = 1700
MAX_DECODE_SIDE = 4096

cv2.setNumThreads(1)
cv2.ocl.setUseOpenCL(False)


@dataclass(frozen=True)
class PreparedGroup:
    group: int
    image_jpeg: bytes


@dataclass(frozen=True)
class PreparedForm:
    warped_jpeg: bytes
    metadata_jpeg: bytes
    groups: tuple[PreparedGroup, ...]
    warnings: tuple[str, ...]
    width: int
    height: int
    table_left: int
    table_top: int
    table_right: int
    table_bottom: int


def _order_points(points: np.ndarray) -> np.ndarray:
    points = points.reshape(4, 2).astype("float32")
    sums = points.sum(axis=1)
    deltas = points[:, 1] - points[:, 0]
    return np.array(
        [
            points[np.argmin(sums)],
            points[np.argmin(deltas)],
            points[np.argmax(sums)],
            points[np.argmax(deltas)],
        ],
        dtype="float32",
    )


def _decode_image(image_bytes: bytes) -> np.ndarray:
    try:
        image = Image.open(BytesIO(image_bytes))
    except Exception as exc:
        raise ValueError("無法讀取圖片，請改用 JPEG、PNG 或 WebP 檔。") from exc

    if image.width * image.height > 80_000_000:
        raise ValueError("圖片尺寸過大，請先縮小到 8000 萬像素以下。")

    # JPEG can decode directly at a smaller size, avoiding a full 48 MP RGB buffer.
    image.draft("RGB", (MAX_DECODE_SIDE, MAX_DECODE_SIDE))
    image = ImageOps.exif_transpose(image)
    if max(image.size) > MAX_DECODE_SIDE:
        image.thumbnail(
            (MAX_DECODE_SIDE, MAX_DECODE_SIDE),
            Image.Resampling.LANCZOS,
        )
    rgb = image.convert("RGB")
    return cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR)


def _find_paper_quad(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    scale = min(1.0, 1800 / max(height, width))
    small = cv2.resize(
        image,
        None,
        fx=scale,
        fy=scale,
        interpolation=cv2.INTER_AREA,
    )
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    otsu = int(cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0])
    thresholds = list(dict.fromkeys([max(90, min(150, otsu)), 100, 120, 140]))
    best_quad: np.ndarray | None = None
    best_area = 0.0

    for threshold in thresholds:
        _, mask = cv2.threshold(blurred, threshold, 255, cv2.THRESH_BINARY)
        mask = cv2.morphologyEx(
            mask,
            cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)),
        )
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:8]:
            area = cv2.contourArea(contour)
            if area < small.shape[0] * small.shape[1] * 0.18:
                continue
            perimeter = cv2.arcLength(contour, True)
            polygon = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
            if len(polygon) == 4 and area > best_area:
                best_quad = polygon.reshape(4, 2).astype("float32")
                best_area = area

    if best_quad is None:
        raise ValueError("找不到完整表單邊界，請確認紙張完整入鏡且背景與紙張有明顯對比。")

    return _order_points(best_quad / scale)


def _warp_paper(image: np.ndarray, quad: np.ndarray) -> np.ndarray:
    destination = np.array(
        [
            [0, 0],
            [WARP_WIDTH - 1, 0],
            [WARP_WIDTH - 1, WARP_HEIGHT - 1],
            [0, WARP_HEIGHT - 1],
        ],
        dtype="float32",
    )
    matrix = cv2.getPerspectiveTransform(quad.astype("float32"), destination)
    return cv2.warpPerspective(image, matrix, (WARP_WIDTH, WARP_HEIGHT))


def _cluster_positions(indices: np.ndarray, gap: int = 5) -> list[int]:
    if len(indices) == 0:
        return []
    positions = [int(indices[0])]
    start = previous = int(indices[0])
    for value in indices[1:]:
        value = int(value)
        if value - previous > gap:
            positions.append((start + previous) // 2)
            start = value
        previous = value
    positions.append((start + previous) // 2)
    return positions


def _detect_table(warped: np.ndarray) -> tuple[int, int, int, int, int]:
    height, width = warped.shape[:2]
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        41,
        10,
    )
    vertical = cv2.morphologyEx(
        binary,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, 120)),
    )
    horizontal = cv2.morphologyEx(
        binary,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (400, 1)),
    )

    vertical_counts = (vertical > 0).sum(axis=0)
    vertical_lines = _cluster_positions(
        np.where(vertical_counts > height * 0.18)[0]
    )
    vertical_lines = [x for x in vertical_lines if width * 0.05 < x < width * 0.98]
    if len(vertical_lines) < 6:
        raise ValueError("找到紙張，但無法定位表格左右邊界。")

    horizontal_counts = (horizontal > 0).sum(axis=1)
    horizontal_lines = _cluster_positions(
        np.where(horizontal_counts > width * 0.10)[0]
    )
    horizontal_lines = [
        y for y in horizontal_lines if height * 0.02 < y < height * 0.99
    ]
    if len(horizontal_lines) < 3:
        raise ValueError("找到紙張，但無法定位表格橫線。")

    table_top = horizontal_lines[0]
    table_bottom = horizontal_lines[-1]
    header_candidates = [
        y for y in horizontal_lines[1:] if 45 <= y - table_top <= 160
    ]
    if not header_candidates:
        raise ValueError("無法定位表格標題列。")
    header_bottom = header_candidates[-1]

    table_left = vertical_lines[0] - 8
    table_right = vertical_lines[-1] + 8
    if table_bottom - header_bottom < height * 0.7:
        raise ValueError("表格組別範圍不完整，請重新拍攝。")
    return table_left, table_top, table_right, table_bottom, header_bottom


def _encode_jpeg(image: np.ndarray, quality: int = 92) -> bytes:
    success, encoded = cv2.imencode(
        ".jpg",
        image,
        [cv2.IMWRITE_JPEG_QUALITY, quality],
    )
    if not success:
        raise ValueError("無法建立表格預覽圖。")
    return encoded.tobytes()


def prepare_form(image_bytes: bytes) -> PreparedForm:
    image = _decode_image(image_bytes)
    paper_quad = _find_paper_quad(image)
    warped = _warp_paper(image, paper_quad)
    del image
    table_left, table_top, table_right, table_bottom, header_bottom = _detect_table(
        warped
    )

    height, width = warped.shape[:2]
    table_left = max(0, table_left)
    table_right = min(width, table_right)
    group_height = (table_bottom - header_bottom) / 8
    groups = []
    for index in range(8):
        y0 = max(0, int(header_bottom + index * group_height) - 10)
        # Corrections are often written below the result row in red ink.
        y1 = min(height, int(header_bottom + (index + 1) * group_height) + 60)
        crop = warped[y0:y1, max(0, table_left - 8) : min(width, table_right + 8)]
        groups.append(
            PreparedGroup(group=index + 1, image_jpeg=_encode_jpeg(crop))
        )

    metadata_top = max(0, table_top - 175)
    metadata_bottom = min(height, header_bottom + 12)
    metadata_crop = warped[
        metadata_top:metadata_bottom,
        max(0, table_left - 12) : min(width, table_right + 12),
    ]

    warnings: list[str] = []
    if len(groups) != 8:
        warnings.append("表格組別數量不完整。")

    return PreparedForm(
        warped_jpeg=_encode_jpeg(warped),
        metadata_jpeg=_encode_jpeg(metadata_crop, quality=94),
        groups=tuple(groups),
        warnings=tuple(warnings),
        width=WARP_WIDTH,
        height=WARP_HEIGHT,
        table_left=table_left,
        table_top=table_top,
        table_right=table_right,
        table_bottom=table_bottom,
    )

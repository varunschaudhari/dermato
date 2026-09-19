import cv2
import numpy as np


def preprocess(image: np.ndarray) -> np.ndarray:
    """Noise reduction + white balance correction."""
    denoised = cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
    balanced = _white_balance(denoised)
    return balanced


def _white_balance(image: np.ndarray) -> np.ndarray:
    result = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    avg_a = np.average(result[:, :, 1])
    avg_b = np.average(result[:, :, 2])
    result[:, :, 1] = result[:, :, 1] - ((avg_a - 128) * (result[:, :, 0] / 255.0) * 1.1)
    result[:, :, 2] = result[:, :, 2] - ((avg_b - 128) * (result[:, :, 0] / 255.0) * 1.1)
    return cv2.cvtColor(result, cv2.COLOR_LAB2BGR)

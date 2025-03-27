import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
import imagehash
from PIL import Image
import os

# Paths to student and teacher screenshot folders
STUDENT_IMAGE_PATH = "screenshots/student_screenshots"
TEACHER_IMAGE_PATH = "screenshots/teacher_screenshots"

def load_image(image_path):
    """Load an image from a file."""
    if not os.path.exists(image_path):
        print(f"❌ Error: Image not found -> {image_path}")
        return None
    return cv2.imread(image_path)

def compute_ssim(image1, image2):
    """Compute Structural Similarity Index (SSIM) between two images."""
    gray1 = cv2.cvtColor(image1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(image2, cv2.COLOR_BGR2GRAY)
    score = ssim(gray1, gray2)
    return max(0, score * 100)  # Ensure the score is non-negative

def compute_phash(image1_path, image2_path):
    """Compute Perceptual Hashing (pHash) similarity score."""
    hash1 = imagehash.phash(Image.open(image1_path))
    hash2 = imagehash.phash(Image.open(image2_path))
    similarity = max(0, 1 - (hash1 - hash2) / len(hash1.hash)) * 100  # Ensure non-negative
    return similarity

def compute_color_histogram_similarity(image1, image2):
    """Compare color histograms of two images."""
    hist1 = cv2.calcHist([image1], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    hist2 = cv2.calcHist([image2], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
    
    hist1 = cv2.normalize(hist1, hist1).flatten()
    hist2 = cv2.normalize(hist2, hist2).flatten()
    
    score = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)  # Correlation method
    return max(0, score * 100)  # Ensure non-negative

def compute_accessibility_score(image1, image2):
    """Compare Edge Maps to estimate accessibility and readability."""
    edges1 = cv2.Canny(cv2.cvtColor(image1, cv2.COLOR_BGR2GRAY), 100, 200)
    edges2 = cv2.Canny(cv2.cvtColor(image2, cv2.COLOR_BGR2GRAY), 100, 200)
    
    score, _ = ssim(edges1, edges2, full=True)
    return max(0, score * 100)  # Ensure non-negative

def compare_all_ui_similarities():
    """Compare all student screenshots with corresponding teacher screenshots and calculate an overall score."""
    
    student_images = sorted(os.listdir(STUDENT_IMAGE_PATH))
    teacher_images = sorted(os.listdir(TEACHER_IMAGE_PATH))
    
    total_design = total_structure = total_accessibility = total_color = total_final = 0
    image_count = 0

    for filename in student_images:
        student_image_path = os.path.join(STUDENT_IMAGE_PATH, filename)
        teacher_image_path = os.path.join(TEACHER_IMAGE_PATH, filename)  

        if not os.path.exists(teacher_image_path):
            print(f"⚠️ Warning: No matching teacher screenshot for {filename}")
            continue

        student_img = load_image(student_image_path)
        teacher_img = load_image(teacher_image_path)

        if student_img is None or teacher_img is None:
            continue

        teacher_img = cv2.resize(teacher_img, (student_img.shape[1], student_img.shape[0]))

        # Compute similarity scores
        ssim_score = compute_ssim(student_img, teacher_img)  # Structure Score
        phash_score = compute_phash(student_image_path, teacher_image_path)  # Design Score
        color_score = compute_color_histogram_similarity(student_img, teacher_img)  # Color Contrast Score
        accessibility_score = compute_accessibility_score(student_img, teacher_img)  # Accessibility Score

        # Final weighted score per image
        final_score = (
            (phash_score * 0.40) +    # Design (40%)
            (ssim_score * 0.30) +     # Structure (30%)
            (accessibility_score * 0.15) +  # Accessibility (15%)
            (color_score * 0.15)      # Color Contrast (15%)
        )

        # Add to totals
        total_design += phash_score
        total_structure += ssim_score
        total_accessibility += accessibility_score
        total_color += color_score
        total_final += final_score
        image_count += 1

        print(f"\n🔍 **Comparison for: {filename}**")
        print(f"🎨 Design Similarity: {phash_score:.2f}%")
        print(f"📌 Structure Similarity: {ssim_score:.2f}%")
        print(f"🛠️ Accessibility Similarity: {accessibility_score:.2f}%")
        print(f"🌈 Color Contrast Similarity: {color_score:.2f}%")
        print(f"\n✅ **Final UI Similarity Score for {filename}: {final_score:.2f}%**\n")

    # Calculate average scores
    if image_count > 0:
        avg_design = total_design / image_count
        avg_structure = total_structure / image_count
        avg_accessibility = total_accessibility / image_count
        avg_color = total_color / image_count
        avg_final = total_final / image_count

        print("\n📊 **Overall UI Similarity Report**")
        print(f"🎨 **Average Design Similarity**: {avg_design:.2f}%")
        print(f"📌 **Average Structure Similarity**: {avg_structure:.2f}%")
        print(f"🛠️ **Average Accessibility Similarity**: {avg_accessibility:.2f}%")
        print(f"🌈 **Average Color Contrast Similarity**: {avg_color:.2f}%")
        print(f"\n✅ **Final Overall UI Similarity Score**: {avg_final:.2f}%\n")
    else:
        print("\n❌ No valid images found for comparison.")

if __name__ == "__main__":
    compare_all_ui_similarities()


import os
import numpy as np
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer
import numpy as np

# Securely load API key
API_KEY = "pcsk_258G7D_9ztWnjnYFWnFzXTTH3pcWjb8vrXQPycVFB4wkm6vq4NTDoCLSJY82AVGmZo3z8f"

# Initialize Pinecone
pc = Pinecone(api_key=API_KEY)
index_name = "webvizio"

def get_embedding_model():
    models = [
        ('all-mpnet-base-v2', 768),
        ('all-MiniLM-L6-v2', 384),
        ('multi-qa-MiniLM-L6-dot-v1', 384)
    ]
    
    for model_name, dimension in models:
        try:
            model = SentenceTransformer(model_name)
            return model, dimension
        except Exception as e:
            print(f"Failed to load {model_name}: {e}")
    
    raise ValueError("Could not load any embedding model")

# Load embedding model dynamically
embedding_model, VECTOR_DIMENSION = get_embedding_model()

def get_or_create_index():
    try:
        # Check if index already exists
        existing_indexes = pc.list_indexes().indexes
        existing_index = next((idx for idx in existing_indexes if idx.name == index_name), None)
        
        if existing_index:
            # If index exists, try to delete it first
            try:
                pc.delete_index(index_name)
                print(f"Deleted existing index: {index_name}")
            except Exception as delete_error:
                print(f"Error deleting existing index: {delete_error}")
        
        # Create new index
        pc.create_index(
            name=index_name, 
            dimension=VECTOR_DIMENSION,
            metric='cosine',
            spec=ServerlessSpec(
                cloud='aws',
                region='us-east-1'
            )
        )
        print(f"Created new index: {index_name} with dimension {VECTOR_DIMENSION}")
        
        # Wait for index to be ready and connect
        pc.describe_index(index_name)
        return pc.Index(index_name)
    except Exception as e:
        print(f"Comprehensive error initializing Pinecone index: {e}")
        import traceback
        traceback.print_exc()
        return None

def safe_index_initialization(max_attempts=3):
    for attempt in range(max_attempts):
        try:
            index = get_or_create_index()
            if index is not None:
                return index
            print(f"Initialization attempt {attempt + 1} failed")
        except Exception as e:
            print(f"Initialization error on attempt {attempt + 1}: {e}")
    
    print("Failed to initialize Pinecone index after multiple attempts")
    return None

# Initialize the index with safe method
index = safe_index_initialization()

def read_code_files(project_path):
    code_content = []
    try:
        for root, _, files in os.walk(project_path):
            for file in files:
                if file.endswith((".html", ".css", ".js", ".jsx", ".tsx", ".py", ".md", ".txt")):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            file_code = f.read()
                            if file_code.strip():
                                code_content.append(file_code)
                    except IOError as file_error:
                        print(f"Error reading file {file_path}: {file_error}")
        
        return "\n\n".join(code_content)
    except Exception as e:
        print(f"Error walking directory {project_path}: {e}")
        return ""

def generate_embedding(code):
    return embedding_model.encode(code).tolist()

def calculate_cosine_similarity(vector1, vector2):
    """Calculate cosine similarity between two vectors."""
    dot_product = np.dot(vector1, vector2)
    norm1 = np.linalg.norm(vector1)
    norm2 = np.linalg.norm(vector2)
    return dot_product / (norm1 * norm2)

def process_project(project_folder, student_name, stored_vectors=None):
    if not index:
        print("Pinecone index not initialized. Skipping project.")
        return None

    try:
        # Read code from project
        code = read_code_files(project_folder)
        
        # Generate embedding
        vector = generate_embedding(code)
        
        print(f"Code length for {student_name}: {len(code)} characters")
        
        # If stored_vectors is provided, check similarity against existing vectors
        if stored_vectors:
            for stored_name, stored_vector in stored_vectors.items():
                if stored_name != student_name:
                    similarity = calculate_cosine_similarity(vector, stored_vector)
                    print(f"Similarity between {student_name} and {stored_name}: {similarity*100:.2f}%")
                    
                    if similarity > 0.8:  # High similarity threshold
                        print(f"⚠️ POTENTIAL PLAGIARISM DETECTED!")
                        print(f"{student_name}'s project is {similarity*100:.2f}% similar to {stored_name}")
        
        # Store the vector for future comparisons
        index.upsert([(student_name, vector)])
        print(f"✅ Stored {student_name}'s project in Pinecone.")
        
        return vector
    except Exception as e:
        print(f"Error processing project {student_name}: {e}")
        return None

def main():
    base_folder = "projects"
    if not os.path.exists(base_folder):
        print(f"Project folder {base_folder} does not exist.")
        return

    # Ensure index is initialized
    global index
    if not index:
        index = safe_index_initialization()
        if not index:
            print("Failed to initialize Pinecone index. Exiting.")
            return

    # Clear existing vectors before processing
    try:
        index.delete(delete_all=True)
        print("Cleared existing vectors from the index.")
    except Exception as e:
        print(f"Error clearing index: {e}")

    # Dictionary to store vectors for comparison
    stored_vectors = {}

    # Process all projects
    for student_project in os.listdir(base_folder):
        student_path = os.path.join(base_folder, student_project)
        if os.path.isdir(student_path):
            vector = process_project(student_path, student_project, stored_vectors)
            if vector is not None:
                stored_vectors[student_project] = vector

if __name__ == "__main__":
    main()
from pathlib import Path
import re


SUPPORTED_EXTENSIONS = {".txt", ".md"}


def load_documents(directory: str) -> list[dict]:
    """Load text and Markdown documents."""

    documents = []
    folder = Path(directory)

    if not folder.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")

    for file_path in folder.rglob("*"):
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            content = file_path.read_text(encoding="utf-8-sig")

            if content.strip():
                documents.append({
                    "content": content,
                    "source": str(file_path.relative_to(folder))
                })

    return documents


def chunk_text(
    text: str,
    chunk_size: int = 150,
    overlap: int = 30
) -> list[str]:
    """Split documents using Markdown headings and word-based chunks."""

    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("Invalid chunk_size or overlap.")

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\\#", "#")

    # Split only at actual Markdown headings.
    sections = re.split(r"(?m)(?=^#{1,6}\s+)", text)

    chunks = []
    step = chunk_size - overlap

    for section in sections:
        section = section.strip()

        if not section:
            continue

        lines = section.splitlines()

        heading = ""
        if lines and re.match(r"^#{1,6}\s+", lines[0]):
            heading = re.sub(r"^#{1,6}\s+", "", lines[0]).strip()
            body = "\n".join(lines[1:]).strip()
        else:
            body = section

        words = body.split()

        for start in range(0, len(words), step):
            content = " ".join(words[start:start + chunk_size])

            if content:
                chunk = f"{heading}\n{content}" if heading else content
                chunks.append(chunk)

    return chunks
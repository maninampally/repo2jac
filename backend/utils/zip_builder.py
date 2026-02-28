import os
import zipfile
import tempfile


def build_zip(job_id: str, jac_files: dict, readme: str, demo_script: str) -> str:
    """
    Package all converted .jac files + README + demo.sh into a ZIP.
    Returns the path to the created ZIP file.
    """
    tmp_dir  = tempfile.gettempdir()
    zip_path = os.path.join(tmp_dir, f"{job_id}.zip")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:

        # Write each .jac file
        for file_path, jac_code in jac_files.items():
            arcname = file_path if file_path.endswith(".jac") else file_path.replace(".py", ".jac")
            zf.writestr(arcname, jac_code)

        # Write README
        zf.writestr("README.md", readme)

        # Write demo script
        zf.writestr("demo.sh", demo_script)

        # Write .env.example
        zf.writestr(".env.example", "ANTHROPIC_API_KEY=sk-ant-your-key-here\n")

    return zip_path
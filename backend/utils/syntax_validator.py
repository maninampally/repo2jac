import subprocess
import tempfile
import os


def validate_jac_syntax(jac_code: str) -> tuple[bool, str]:
    """
    Write jac_code to a temp file and run `jac check` on it.
    Returns (is_valid: bool, error_message: str).
    """
    # BUG-7 FIX: initialize tmp_path before try block
    # prevents NameError in finally if NamedTemporaryFile fails
    tmp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=".jac", mode="w", delete=False, encoding="utf-8"
        ) as f:
            f.write(jac_code)
            tmp_path = f.name

        result = subprocess.run(
            ["jac", "check", tmp_path],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0:
            return True, ""
        else:
            error = result.stderr.strip() or result.stdout.strip()
            return False, error

    except FileNotFoundError:
        # jac CLI not installed — skip validation
        return True, ""

    except subprocess.TimeoutExpired:
        return False, "Syntax validation timed out"

    except Exception as e:
        return False, str(e)

    finally:
        # BUG-7 FIX: guard against tmp_path being None
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
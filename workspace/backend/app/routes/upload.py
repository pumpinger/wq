"""
文件上传路由
"""
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from ..core.deps import get_current_active_user

router = APIRouter(prefix="/upload", tags=["文件上传"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"))


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user=Depends(get_current_active_user)
):
    """上传图片"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只支持图片文件")

    # 限制文件大小 10MB
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件大小不能超过10MB")

    # 按日期分目录
    date_dir = datetime.now().strftime("%Y%m%d")
    save_dir = os.path.join(UPLOAD_DIR, date_dir)
    os.makedirs(save_dir, exist_ok=True)

    # 生成唯一文件名
    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(save_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # 返回相对路径
    relative_path = f"/uploads/{date_dir}/{filename}"

    return {
        "file_path": relative_path,
        "file_name": file.filename,
        "file_size": len(content),
    }


@router.get("/file/{date_dir}/{filename}")
async def get_file(date_dir: str, filename: str):
    """获取上传的文件"""
    filepath = os.path.join(UPLOAD_DIR, date_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(filepath)

import React, { useRef, useState } from 'react';
import { ActionSheet, SpinLoading, Toast, ImageViewer } from 'antd-mobile';
import { AddOutline, CloseOutline } from 'antd-mobile-icons';
import { visitApi } from '../api';

interface PhotoUploaderProps {
  value?: string[];
  onChange?: (paths: string[]) => void;
  maxCount?: number;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({ value = [], onChange, maxCount = 9 }) => {
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const handleActionSheet = () => {
    if (value.length >= maxCount) {
      Toast.show({ content: `最多上传${maxCount}张照片` });
      return;
    }
    ActionSheet.show({
      actions: [
        { text: '拍照', key: 'camera' },
        { text: '从相册选择', key: 'album' },
      ],
      cancelText: '取消',
      onAction: (action) => {
        if (action.key === 'camera') {
          cameraInputRef.current?.click();
        } else if (action.key === 'album') {
          albumInputRef.current?.click();
        }
      },
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      Toast.show({ content: '请选择图片文件' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      Toast.show({ content: '图片大小不能超过10MB' });
      return;
    }

    setUploading(true);
    try {
      const res = await visitApi.uploadImage(file);
      const filePath = res.data.file_path || res.data.url || res.data;
      const newPaths = [...value, filePath];
      onChange?.(newPaths);
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.response?.data?.detail || '上传失败' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (index: number) => {
    const newPaths = value.filter((_, i) => i !== index);
    onChange?.(newPaths);
  };

  const handlePreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewVisible(true);
  };

  const getImageUrl = (path: string) => {
    if (path.startsWith('http')) return path;
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
    const origin = baseURL.replace(/\/api\/?$/, '');
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {value.map((path, index) => (
        <div
          key={index}
          style={{
            width: 80,
            height: 80,
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid #eee',
          }}
        >
          <img
            src={getImageUrl(path)}
            alt={`photo-${index}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            onClick={() => handlePreview(index)}
          />
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(index);
            }}
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <CloseOutline color="#fff" fontSize={12} />
          </div>
        </div>
      ))}

      {value.length < maxCount && (
        <div
          onClick={handleActionSheet}
          style={{
            width: 80,
            height: 80,
            borderRadius: 8,
            border: '1px dashed #ccc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: '#fafafa',
          }}
        >
          {uploading ? (
            <SpinLoading style={{ '--size': '24px' }} />
          ) : (
            <>
              <AddOutline fontSize={24} color="#999" />
              <span style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                {value.length}/{maxCount}
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <ImageViewer.Multi
        images={value.map(getImageUrl)}
        visible={previewVisible}
        defaultIndex={previewIndex}
        onClose={() => setPreviewVisible(false)}
      />
    </div>
  );
};

export default PhotoUploader;

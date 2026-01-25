import React, { useState, useEffect } from 'react';
import { Modal, Button, Space, InputNumber, message } from 'antd';
import { EnvironmentOutlined, AimOutlined } from '@ant-design/icons';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 修复 Leaflet 默认图标问题
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface LocationPickerProps {
  latitude?: number;
  longitude?: number;
  onChange?: (lat: number, lng: number) => void;
}

// 点击地图获取位置的组件
const MapClickHandler: React.FC<{
  onLocationSelect: (lat: number, lng: number) => void;
}> = ({ onLocationSelect }) => {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// 定位到指定位置的组件
const FlyToLocation: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 15);
    }
  }, [lat, lng, map]);
  return null;
};

const LocationPicker: React.FC<LocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempLat, setTempLat] = useState<number | undefined>(latitude);
  const [tempLng, setTempLng] = useState<number | undefined>(longitude);

  // 默认中心点（北京）
  const defaultCenter: [number, number] = [39.9042, 116.4074];

  const handleOpen = () => {
    setTempLat(latitude);
    setTempLng(longitude);
    setModalVisible(true);
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setTempLat(parseFloat(lat.toFixed(7)));
    setTempLng(parseFloat(lng.toFixed(7)));
  };

  const handleConfirm = () => {
    if (tempLat !== undefined && tempLng !== undefined) {
      onChange?.(tempLat, tempLng);
      setModalVisible(false);
    } else {
      message.warning('请在地图上点击选择位置');
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = parseFloat(position.coords.latitude.toFixed(7));
          const lng = parseFloat(position.coords.longitude.toFixed(7));
          setTempLat(lat);
          setTempLng(lng);
          message.success('已获取当前位置');
        },
        (error) => {
          message.error('获取位置失败: ' + error.message);
        }
      );
    } else {
      message.error('浏览器不支持定位功能');
    }
  };

  const hasLocation = latitude !== undefined && longitude !== undefined;

  return (
    <>
      <Space>
        <Button
          icon={<EnvironmentOutlined />}
          onClick={handleOpen}
        >
          {hasLocation ? '修改位置' : '在地图上选择'}
        </Button>
        {hasLocation && (
          <span style={{ color: '#666', fontSize: 12 }}>
            已选: {latitude}, {longitude}
          </span>
        )}
      </Space>

      <Modal
        title="选择位置"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleConfirm}
        okText="确认"
        cancelText="取消"
        width={700}
        styles={{ body: { padding: '12px 0' } }}
      >
        <div style={{ marginBottom: 12 }}>
          <Space>
            <span>纬度:</span>
            <InputNumber
              value={tempLat}
              onChange={(v) => setTempLat(v ?? undefined)}
              min={-90}
              max={90}
              precision={7}
              style={{ width: 140 }}
            />
            <span>经度:</span>
            <InputNumber
              value={tempLng}
              onChange={(v) => setTempLng(v ?? undefined)}
              min={-180}
              max={180}
              precision={7}
              style={{ width: 140 }}
            />
            <Button
              icon={<AimOutlined />}
              onClick={handleGetCurrentLocation}
            >
              当前位置
            </Button>
          </Space>
        </div>

        <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>
          提示：点击地图选择位置，或拖动标记微调
        </div>

        <div style={{ height: 400, borderRadius: 8, overflow: 'hidden' }}>
          <MapContainer
            center={
              tempLat && tempLng
                ? [tempLat, tempLng]
                : defaultCenter
            }
            zoom={tempLat && tempLng ? 15 : 10}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onLocationSelect={handleLocationSelect} />
            {tempLat && tempLng && (
              <>
                <Marker
                  position={[tempLat, tempLng]}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const position = marker.getLatLng();
                      setTempLat(parseFloat(position.lat.toFixed(7)));
                      setTempLng(parseFloat(position.lng.toFixed(7)));
                    },
                  }}
                />
                <FlyToLocation lat={tempLat} lng={tempLng} />
              </>
            )}
          </MapContainer>
        </div>
      </Modal>
    </>
  );
};

export default LocationPicker;

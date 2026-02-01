import React, { useState } from 'react';
import { Button, Toast, Popup, Space } from 'antd-mobile';
import { EnvironmentOutline, LocationOutline } from 'antd-mobile-icons';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Props {
  value?: { lat?: number; lng?: number };
  onChange?: (val: { lat: number; lng: number }) => void;
}

const LocationPicker: React.FC<Props> = ({ value, onChange }) => {
  const [showMap, setShowMap] = useState(false);
  const [tempPos, setTempPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const hasValue = value?.lat && value?.lng;

  const handleGPS = () => {
    if (!navigator.geolocation) {
      Toast.show({ icon: 'fail', content: '浏览器不支持定位' });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange?.(loc);
        setLoading(false);
        Toast.show({ icon: 'success', content: '定位成功' });
      },
      (err) => {
        setLoading(false);
        Toast.show({ icon: 'fail', content: '定位失败，请检查权限' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const MapClickHandler: React.FC = () => {
    useMapEvents({
      click: (e) => {
        setTempPos({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return null;
  };

  const handleConfirmMap = () => {
    if (tempPos) {
      onChange?.(tempPos);
      Toast.show({ icon: 'success', content: '已选择位置' });
    }
    setShowMap(false);
    setTempPos(null);
  };

  return (
    <div>
      <Space wrap>
        <Button size="small" loading={loading} onClick={handleGPS}>
          <LocationOutline /> GPS定位
        </Button>
        <Button size="small" onClick={() => { setTempPos(hasValue ? { lat: value!.lat!, lng: value!.lng! } : null); setShowMap(true); }}>
          <EnvironmentOutline /> 地图选点
        </Button>
      </Space>
      {hasValue && (
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          {value!.lat!.toFixed(6)}, {value!.lng!.toFixed(6)}
        </div>
      )}

      <Popup
        visible={showMap}
        onMaskClick={() => setShowMap(false)}
        bodyStyle={{ height: '70vh', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>点击地图选择位置</span>
            <Button size="small" color="primary" onClick={handleConfirmMap} disabled={!tempPos}>
              确定
            </Button>
          </div>
          <div style={{ flex: 1 }}>
            <MapContainer
              center={tempPos || (hasValue ? [value!.lat!, value!.lng!] : [39.9, 116.4])}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; OSM'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler />
              {tempPos && <Marker position={[tempPos.lat, tempPos.lng]} icon={defaultIcon} />}
            </MapContainer>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default LocationPicker;

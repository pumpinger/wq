import React, { useEffect, useState } from 'react';
import { Card, Select, Space, Spin, Button, Tag } from 'antd';
import { ReloadOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { customerApi, templateApi, fieldApi } from '../api';
import type { Customer, CustomerTemplate, FieldDefinition } from '../types';

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

interface CustomerWithCoords extends Customer {
  latitude: number;
  longitude: number;
}

// 自动调整地图视野的组件
const FitBounds: React.FC<{ customers: CustomerWithCoords[] }> = ({ customers }) => {
  const map = useMap();

  useEffect(() => {
    if (customers.length > 0) {
      const bounds = L.latLngBounds(
        customers.map(c => [Number(c.latitude), Number(c.longitude)])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [customers, map]);

  return null;
};

const CustomerMap: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<number | undefined>();
  const [selectedFieldFilters, setSelectedFieldFilters] = useState<Record<number, string>>({});

  // 获取客户列表（只获取有坐标的）
  const { data: customers, isLoading: customersLoading, refetch } = useQuery({
    queryKey: ['customers', { has_coords: true }],
    queryFn: () => customerApi.list({ has_coords: true, limit: 100 }).then((res) => res.data as Customer[]),
  });

  // 获取模板列表
  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateApi.list().then((res) => res.data as CustomerTemplate[]),
  });

  // 获取字段定义列表
  const { data: fields } = useQuery({
    queryKey: ['fields'],
    queryFn: () => fieldApi.list().then((res) => res.data as FieldDefinition[]),
  });

  // 获取选中模板的字段
  const selectedTemplateFields = React.useMemo(() => {
    if (!selectedTemplate || !templates) return [];
    const template = templates.find(t => t.id === selectedTemplate);
    return template?.template_fields || [];
  }, [selectedTemplate, templates]);

  // 筛选客户（API 已返回有坐标的客户）
  const filteredCustomers = React.useMemo(() => {
    if (!customers) return [];

    let result = customers as CustomerWithCoords[];

    // 按模板筛选
    if (selectedTemplate) {
      result = result.filter(c => c.template_id === selectedTemplate);
    }

    // 按字段值筛选
    Object.entries(selectedFieldFilters).forEach(([fieldId, value]) => {
      if (value) {
        result = result.filter(c => {
          const fieldValue = c.field_values?.find(fv => fv.field_id === parseInt(fieldId));
          if (!fieldValue) return false;
          const val = fieldValue.value;
          if (Array.isArray(val)) {
            return val.includes(value);
          }
          return String(val) === value;
        });
      }
    });

    return result;
  }, [customers, selectedTemplate, selectedFieldFilters]);

  // 获取字段的选项
  const getFieldOptions = (fieldId: number) => {
    const field = fields?.find(f => f.id === fieldId);
    if (!field?.options) return [];
    return field.options;
  };

  // 重置筛选
  const handleReset = () => {
    setSelectedTemplate(undefined);
    setSelectedFieldFilters({});
  };

  // 注意：API 已经只返回有坐标的客户，此变量现在始终为空
  // 如需显示无坐标客户数量，需要额外调用不带 has_coords 筛选的 API
  const customersWithoutCoords: Customer[] = [];

  // 默认中心点（北京）
  const defaultCenter: [number, number] = [39.9042, 116.4074];
  const defaultZoom = 10;

  return (
    <Card
      title={
        <Space>
          <EnvironmentOutlined />
          客户分布地图
          <Tag color="blue">{filteredCustomers.length} 个客户</Tag>
          {customersWithoutCoords.length > 0 && (
            <Tag color="orange">{customersWithoutCoords.length} 个无坐标</Tag>
          )}
        </Space>
      }
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          刷新
        </Button>
      }
    >
      {/* 筛选栏 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Space>
          <span>模板:</span>
          <Select
            style={{ width: 150 }}
            placeholder="全部模板"
            allowClear
            value={selectedTemplate}
            onChange={(v) => {
              setSelectedTemplate(v);
              setSelectedFieldFilters({});
            }}
          >
            {templates?.map(t => (
              <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
            ))}
          </Select>
        </Space>

        {/* 动态字段筛选 */}
        {selectedTemplateFields.map(tf => {
          const field = fields?.find(f => f.id === tf.field_id);
          if (!field || !['select', 'multi_select'].includes(field.field_type)) return null;

          return (
            <Space key={tf.field_id}>
              <span>{field.name}:</span>
              <Select
                style={{ width: 120 }}
                placeholder="全部"
                allowClear
                value={selectedFieldFilters[tf.field_id]}
                onChange={(v) => setSelectedFieldFilters(prev => ({
                  ...prev,
                  [tf.field_id]: v,
                }))}
              >
                {getFieldOptions(tf.field_id).map((opt: string) => (
                  <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                ))}
              </Select>
            </Space>
          );
        })}

        {(selectedTemplate || Object.keys(selectedFieldFilters).length > 0) && (
          <Button size="small" onClick={handleReset}>重置筛选</Button>
        )}
      </div>

      {/* 地图容器 */}
      <Spin spinning={customersLoading}>
        <div
          style={{
            width: '100%',
            height: 'calc(100vh - 300px)',
            minHeight: 400,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredCustomers.map(customer => {
              const template = templates?.find(t => t.id === customer.template_id);
              return (
                <Marker
                  key={customer.id}
                  position={[Number(customer.latitude), Number(customer.longitude)]}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <h4 style={{ margin: '0 0 8px 0' }}>{customer.name}</h4>
                      <p style={{ margin: '4px 0', color: '#666' }}>
                        <strong>地址:</strong> {customer.address || '-'}
                      </p>
                      {template && (
                        <p style={{ margin: '4px 0', color: '#666' }}>
                          <strong>模板:</strong> {template.name}
                        </p>
                      )}
                      <p style={{ margin: '4px 0', color: '#999', fontSize: 12 }}>
                        坐标: {customer.latitude}, {customer.longitude}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            <FitBounds customers={filteredCustomers} />
          </MapContainer>
        </div>
      </Spin>

      {/* 无坐标客户提示 */}
      {customersWithoutCoords.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: '#fffbe6', borderRadius: 4 }}>
          <strong>提示:</strong> 有 {customersWithoutCoords.length} 个客户未填写坐标，无法在地图上显示。
          请在客户详情中补充经纬度信息。
        </div>
      )}
    </Card>
  );
};

export default CustomerMap;

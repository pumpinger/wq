import React, { useState } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Radio,
  Switch,
  Button,
  Table,
  Modal,
  Input,
  Space,
  Tag,
  message,
  Popconfirm,
  Divider,
  Spin,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import type { AttendanceConfig as AttendanceConfigType, AttendanceLocation, AttendanceShift } from '../../types';

const AttendanceConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [configForm] = Form.useForm();
  const [locationForm] = Form.useForm();
  const [shiftForm] = Form.useForm();
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AttendanceLocation | null>(null);
  const [editingShift, setEditingShift] = useState<AttendanceShift | null>(null);

  // ── 基本设置 ──
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: queryKeys.attendance.config(),
    queryFn: async () => {
      const res = await attendanceApi.getConfig();
      return res.data as AttendanceConfigType;
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: any) => attendanceApi.updateConfig(data),
    onSuccess: () => {
      message.success('设置已保存');
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.config() });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '保存失败');
    },
  });

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      updateConfigMutation.mutate(values);
    } catch {
      // validation error
    }
  };

  // ── 打卡地点 ──
  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: queryKeys.attendance.locations(),
    queryFn: async () => {
      const res = await attendanceApi.listLocations();
      return res.data as AttendanceLocation[];
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: (data: any) => attendanceApi.createLocation(data),
    onSuccess: () => {
      message.success('地点创建成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.locations() });
      closeLocationModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => attendanceApi.updateLocation(id, data),
    onSuccess: () => {
      message.success('地点更新成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.locations() });
      closeLocationModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (id: number) => attendanceApi.deleteLocation(id),
    onSuccess: () => {
      message.success('地点已删除');
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.locations() });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  const openLocationModal = (loc?: AttendanceLocation) => {
    if (loc) {
      setEditingLocation(loc);
      locationForm.setFieldsValue(loc);
    } else {
      setEditingLocation(null);
      locationForm.resetFields();
    }
    setLocationModalOpen(true);
  };

  const closeLocationModal = () => {
    setLocationModalOpen(false);
    setEditingLocation(null);
    locationForm.resetFields();
  };

  const handleSubmitLocation = async () => {
    try {
      const values = await locationForm.validateFields();
      if (editingLocation) {
        updateLocationMutation.mutate({ id: editingLocation.id, data: values });
      } else {
        createLocationMutation.mutate(values);
      }
    } catch {
      // validation error
    }
  };

  // ── 班次管理 ──
  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: queryKeys.attendance.shifts(),
    queryFn: async () => {
      const res = await attendanceApi.listShifts();
      return res.data as AttendanceShift[];
    },
  });

  const createShiftMutation = useMutation({
    mutationFn: (data: any) => attendanceApi.createShift(data),
    onSuccess: () => {
      message.success('班次创建成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.shifts() });
      closeShiftModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '创建失败');
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => attendanceApi.updateShift(id, data),
    onSuccess: () => {
      message.success('班次更新成功');
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.shifts() });
      closeShiftModal();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '更新失败');
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: number) => attendanceApi.deleteShift(id),
    onSuccess: () => {
      message.success('班次已删除');
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.shifts() });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || '删除失败');
    },
  });

  const openShiftModal = (shift?: AttendanceShift) => {
    if (shift) {
      setEditingShift(shift);
      shiftForm.setFieldsValue(shift);
    } else {
      setEditingShift(null);
      shiftForm.resetFields();
    }
    setShiftModalOpen(true);
  };

  const closeShiftModal = () => {
    setShiftModalOpen(false);
    setEditingShift(null);
    shiftForm.resetFields();
  };

  const handleSubmitShift = async () => {
    try {
      const values = await shiftForm.validateFields();
      if (editingShift) {
        updateShiftMutation.mutate({ id: editingShift.id, data: values });
      } else {
        createShiftMutation.mutate(values);
      }
    } catch {
      // validation error
    }
  };

  // ── 打卡地点表格列 ──
  const locationColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 120 },
    { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
    { title: '纬度', dataIndex: 'latitude', key: 'latitude', width: 100 },
    { title: '经度', dataIndex: 'longitude', key: 'longitude', width: 100 },
    { title: '半径(米)', dataIndex: 'radius', key: 'radius', width: 80 },
    { title: 'WiFi SSID', dataIndex: 'wifi_ssid', key: 'wifi_ssid', width: 120, render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 70,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: AttendanceLocation) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openLocationModal(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该地点吗？" onConfirm={() => deleteLocationMutation.mutate(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── 班次表格列 ──
  const shiftColumns = [
    { title: '班次名称', dataIndex: 'name', key: 'name', width: 120 },
    { title: '上班时间', dataIndex: 'start_time', key: 'start_time', width: 90 },
    { title: '下班时间', dataIndex: 'end_time', key: 'end_time', width: 90 },
    { title: '休息开始', dataIndex: 'break_start', key: 'break_start', width: 90, render: (v: string) => v || '-' },
    { title: '休息结束', dataIndex: 'break_end', key: 'break_end', width: 90, render: (v: string) => v || '-' },
    { title: '弹性开始', dataIndex: 'flex_start_from', key: 'flex_start_from', width: 90, render: (v: string) => v || '-' },
    { title: '弹性结束', dataIndex: 'flex_start_to', key: 'flex_start_to', width: 90, render: (v: string) => v || '-' },
    {
      title: '默认',
      dataIndex: 'is_default',
      key: 'is_default',
      width: 70,
      render: (v: boolean) => (v ? <Tag color="blue">默认</Tag> : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: AttendanceShift) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openShiftModal(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该班次吗？" onConfirm={() => deleteShiftMutation.mutate(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 基本设置 */}
      <Card title="基本设置">
        {configLoading ? (
          <Spin />
        ) : (
          <Form
            form={configForm}
            layout="vertical"
            initialValues={config || {}}
            style={{ maxWidth: 600 }}
          >
            <Form.Item name="schedule_mode" label="排班模式" rules={[{ required: true }]}>
              <Radio.Group>
                <Radio value="fixed">固定</Radio>
                <Radio value="rotating">轮班</Radio>
                <Radio value="flex">弹性</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="punch_radius" label="打卡半径(米)" rules={[{ required: true }]}>
              <InputNumber min={50} max={5000} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="wifi_check_enabled" label="WiFi校验" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item name="late_tolerance_minutes" label="迟到容忍时间(分钟)" rules={[{ required: true }]}>
              <InputNumber min={0} max={60} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="early_leave_tolerance_minutes" label="早退容忍时间(分钟)" rules={[{ required: true }]}>
              <InputNumber min={0} max={60} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSaveConfig} loading={updateConfigMutation.isPending}>
                保存设置
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>

      {/* 打卡地点管理 */}
      <Card
        title="打卡地点管理"
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openLocationModal()}>
            新增地点
          </Button>
        }
      >
        <Table
          columns={locationColumns}
          dataSource={locations || []}
          rowKey="id"
          loading={locationsLoading}
          pagination={false}
          scroll={{ x: 900 }}
          size="small"
        />
      </Card>

      {/* 班次管理 */}
      <Card
        title="班次管理"
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openShiftModal()}>
            新增班次
          </Button>
        }
      >
        <Table
          columns={shiftColumns}
          dataSource={shifts || []}
          rowKey="id"
          loading={shiftsLoading}
          pagination={false}
          scroll={{ x: 900 }}
          size="small"
        />
      </Card>

      {/* 打卡地点弹窗 */}
      <Modal
        title={editingLocation ? '编辑打卡地点' : '新增打卡地点'}
        open={locationModalOpen}
        onOk={handleSubmitLocation}
        onCancel={closeLocationModal}
        confirmLoading={createLocationMutation.isPending || updateLocationMutation.isPending}
      >
        <Form form={locationForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如: 总部办公室" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="详细地址" />
          </Form.Item>
          <Form.Item name="latitude" label="纬度" rules={[{ required: true, message: '请输入纬度' }]}>
            <InputNumber style={{ width: '100%' }} min={-90} max={90} step={0.000001} placeholder="如: 39.908823" />
          </Form.Item>
          <Form.Item name="longitude" label="经度" rules={[{ required: true, message: '请输入经度' }]}>
            <InputNumber style={{ width: '100%' }} min={-180} max={180} step={0.000001} placeholder="如: 116.397470" />
          </Form.Item>
          <Form.Item name="radius" label="打卡半径(米)" rules={[{ required: true, message: '请输入半径' }]}>
            <InputNumber style={{ width: '100%' }} min={50} max={5000} placeholder="默认500米" />
          </Form.Item>
          <Form.Item name="wifi_ssid" label="WiFi SSID">
            <Input placeholder="可选，WiFi名称" />
          </Form.Item>
          <Form.Item name="is_active" label="是否启用" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 班次弹窗 */}
      <Modal
        title={editingShift ? '编辑班次' : '新增班次'}
        open={shiftModalOpen}
        onOk={handleSubmitShift}
        onCancel={closeShiftModal}
        confirmLoading={createShiftMutation.isPending || updateShiftMutation.isPending}
        width={600}
      >
        <Form form={shiftForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="班次名称" rules={[{ required: true, message: '请输入班次名称' }]}>
            <Input placeholder="如: 早班" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="start_time" label="上班时间" rules={[{ required: true, message: '请输入上班时间' }]}>
              <Input placeholder="如: 09:00" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="end_time" label="下班时间" rules={[{ required: true, message: '请输入下班时间' }]}>
              <Input placeholder="如: 18:00" style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Divider plain>休息时间(可选)</Divider>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="break_start" label="休息开始">
              <Input placeholder="如: 12:00" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="break_end" label="休息结束">
              <Input placeholder="如: 13:00" style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Divider plain>弹性时间(可选)</Divider>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="flex_start_from" label="弹性起始">
              <Input placeholder="如: 08:00" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="flex_start_to" label="弹性截止">
              <Input placeholder="如: 10:00" style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Form.Item name="is_default" label="设为默认班次" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AttendanceConfigPage;

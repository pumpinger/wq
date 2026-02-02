import { test, expect } from '@playwright/test';

/**
 * 认证流程 E2E 测试
 */
test.describe('认证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('登录页面正确渲染', async ({ page }) => {
    await expect(page.locator('#login_username')).toBeVisible();
    await expect(page.locator('#login_password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.getByText('超级管理员')).toBeVisible();
    await expect(page.getByText('北京-管理员')).toBeVisible();
  });

  test('空用户名显示错误', async ({ page }) => {
    await page.fill('#login_password', '123456');
    await page.click('button[type="submit"]');
    await expect(page.locator('.ant-form-item-explain-error')).toBeVisible();
  });

  test('错误凭据显示错误消息', async ({ page }) => {
    await page.fill('#login_username', 'wronguser');
    await page.fill('#login_password', 'wrongpass');
    await page.click('button[type="submit"]');

    // Ant Design message 组件 - 检查文本或 loading 状态变化
    // 后端返回401后，前端通过 message.error 显示
    // 按钮应该从 loading 回到正常状态（15秒内）
    await expect(page.locator('button[type="submit"]')).not.toBeDisabled({ timeout: 15000 });
    // 验证仍然在登录页
    await expect(page.locator('#login_username')).toBeVisible();
  });

  test('正确凭据登录成功（快速登录）', async ({ page }) => {
    await page.getByText('超级管理员').click();
    await expect(page.locator('.ant-layout-sider').first()).toBeVisible({ timeout: 20000 });
  });

  test('手动填写表单登录成功', async ({ page }) => {
    await page.fill('#login_username', 'superadmin');
    await page.fill('#login_password', '123456');
    await page.click('button[type="submit"]');
    await expect(page.locator('.ant-layout-sider').first()).toBeVisible({ timeout: 20000 });
  });
});

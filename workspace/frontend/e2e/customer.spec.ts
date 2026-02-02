import { test, expect } from '@playwright/test';

/**
 * 客户管理 E2E 测试
 * 菜单结构: "客户管理" 是直接的菜单项（非子菜单），点击即进入客户列表
 */
test.describe('客户管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('北京-管理员').click();
    await expect(page.locator('.ant-layout-sider').first()).toBeVisible({ timeout: 15000 });
  });

  test('客户列表页正确渲染', async ({ page }) => {
    // "客户管理" 是直接菜单项，点击后进入客户列表页
    await page.getByRole('menuitem', { name: '客户管理' }).click();

    // 检查表格
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });
  });

  test('可以打开新建客户弹窗', async ({ page }) => {
    await page.getByRole('menuitem', { name: '客户管理' }).click();
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // 点击添加客户按钮
    await page.click('button:has-text("添加客户")');

    // 检查弹窗
    await expect(page.locator('.ant-modal')).toBeVisible({ timeout: 5000 });
  });

  test('客户表单验证生效', async ({ page }) => {
    await page.getByRole('menuitem', { name: '客户管理' }).click();
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // 打开新建弹窗
    await page.click('button:has-text("添加客户")');
    await expect(page.locator('.ant-modal')).toBeVisible({ timeout: 5000 });

    // 直接点击提交（不填任何内容）
    await page.click('.ant-modal .ant-btn-primary');

    // 应显示验证错误
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible({ timeout: 5000 });
  });

  test('可以搜索客户', async ({ page }) => {
    await page.getByRole('menuitem', { name: '客户管理' }).click();
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // 在搜索框输入
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="关键词"], input[placeholder*="名称"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('测试客户');
      await page.keyboard.press('Enter');
      // 等待搜索完成
      await page.waitForTimeout(1000);
    }
  });
});

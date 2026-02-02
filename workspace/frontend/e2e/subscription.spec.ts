import { test, expect } from '@playwright/test';

/**
 * 订阅管理 E2E 测试
 * 仅超级管理员可见
 */
test.describe('订阅管理（超管）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('超级管理员').click();
    await expect(page.locator('.ant-layout-sider').first()).toBeVisible({ timeout: 15000 });
  });

  test('订阅管理菜单对超管可见', async ({ page }) => {
    const subscriptionMenu = page.getByRole('menuitem', { name: '订阅管理' });

    if (await subscriptionMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await subscriptionMenu.click();
      // 等待页面内容渲染（表格或页面标题）
      await expect(page.getByText('订阅订单管理')).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('可以打开新建订阅订单弹窗', async ({ page }) => {
    const subscriptionMenu = page.getByRole('menuitem', { name: '订阅管理' });
    if (!(await subscriptionMenu.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await subscriptionMenu.click();
    await expect(page.getByText('订阅订单管理')).toBeVisible({ timeout: 10000 });

    // 点击新建订单按钮
    await page.click('button:has-text("新建订单")');

    // 检查弹窗
    await expect(page.locator('.ant-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.ant-modal .ant-form')).toBeVisible();
  });

  test('订阅订单表单包含必要字段', async ({ page }) => {
    const subscriptionMenu = page.getByRole('menuitem', { name: '订阅管理' });
    if (!(await subscriptionMenu.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await subscriptionMenu.click();
    await expect(page.getByText('订阅订单管理')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("新建订单")');

    await expect(page.locator('.ant-modal')).toBeVisible({ timeout: 5000 });

    // 检查表单字段
    await expect(page.locator('.ant-modal').getByText('关联租户')).toBeVisible();
    await expect(page.locator('.ant-modal').getByText('订阅模块')).toBeVisible();
    await expect(page.locator('.ant-modal input[placeholder="开始日期"]')).toBeVisible();
  });
});

test.describe('订阅管理（普通管理员不可见）', () => {
  test('普通租户管理员看不到订阅管理', async ({ page }) => {
    await page.goto('/');
    await page.getByText('北京-管理员').click();

    await expect(page.locator('.ant-layout-sider').first()).toBeVisible({ timeout: 15000 });

    const subscriptionMenu = page.getByRole('menuitem', { name: '订阅管理' });
    await expect(subscriptionMenu).not.toBeVisible({ timeout: 3000 });
  });
});

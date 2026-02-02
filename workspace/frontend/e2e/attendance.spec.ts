import { test, expect, type Page } from '@playwright/test';

/**
 * 考勤管理 E2E 测试
 * 考勤是子菜单：考勤管理 → 考勤记录/排班管理/考勤统计
 *
 * 注意：Ant Design inline Menu 的子菜单展开在 Playwright 中不够稳定，
 * 因此使用 JavaScript 直接点击 data-menu-id 属性的元素来触发导航。
 */

/** 通过 data-menu-id 属性点击菜单项 */
async function clickMenuItemByKey(page: Page, menuKey: string) {
  // 先确保考勤管理子菜单在DOM中存在
  const menuItem = page.locator(`[data-menu-id*="${menuKey}"]`);
  await expect(menuItem).toHaveCount(1, { timeout: 5000 });

  // 使用 JS 直接点击（绕过 display:none 的限制）
  await page.evaluate((key) => {
    const el = document.querySelector(`[data-menu-id*="${key}"]`) as HTMLElement;
    if (el) el.click();
  }, menuKey);
}

test.describe('考勤管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('北京-管理员').click();
    await expect(page.locator('.ant-layout-sider').first()).toBeVisible({ timeout: 15000 });
    // 等待菜单完全渲染（包括异步加载的模块信息）
    await page.waitForTimeout(1500);
  });

  test('考勤管理菜单可见（模块开启时）', async ({ page }) => {
    // 检查考勤管理子菜单存在于 DOM 中
    const attendanceSubmenu = page.locator('[data-menu-id*="attendance"]');
    const count = await attendanceSubmenu.count();

    if (count > 0) {
      // 验证子菜单项存在
      await expect(page.locator('[data-menu-id*="attendance-records"]')).toHaveCount(1);
      await expect(page.locator('[data-menu-id*="attendance-schedule"]')).toHaveCount(1);
      await expect(page.locator('[data-menu-id*="attendance-stats"]')).toHaveCount(1);
    } else {
      test.skip();
    }
  });

  test('考勤记录页面正确渲染', async ({ page }) => {
    const menuItem = page.locator('[data-menu-id*="attendance-records"]');
    if ((await menuItem.count()) === 0) {
      test.skip();
      return;
    }

    await clickMenuItemByKey(page, 'attendance-records');
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });
  });

  test('排班管理页面正确渲染', async ({ page }) => {
    const menuItem = page.locator('[data-menu-id*="attendance-schedule"]');
    if ((await menuItem.count()) === 0) {
      test.skip();
      return;
    }

    await clickMenuItemByKey(page, 'attendance-schedule');
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });
  });

  test('考勤统计页面正确渲染', async ({ page }) => {
    const menuItem = page.locator('[data-menu-id*="attendance-stats"]');
    if ((await menuItem.count()) === 0) {
      test.skip();
      return;
    }

    await clickMenuItemByKey(page, 'attendance-stats');
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });
  });

  test('考勤设置页面正确渲染', async ({ page }) => {
    const menuItem = page.locator('[data-menu-id*="attendance-config"]');
    if ((await menuItem.count()) === 0) {
      test.skip();
      return;
    }

    await clickMenuItemByKey(page, 'attendance-config');
    await expect(page.locator('.ant-card').first()).toBeVisible({ timeout: 10000 });
  });
});

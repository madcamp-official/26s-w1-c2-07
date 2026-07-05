import { expect, test } from "@playwright/test";

test("home page renders and links to primary flows", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "MVP 개발 환경" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "공연 목록 보기" })).toHaveAttribute(
    "href",
    "/concerts",
  );
  await expect(page.getByRole("link", { name: "마이페이지 확인" })).toHaveAttribute(
    "href",
    "/my",
  );
});

test("login page renders for anonymous users", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("my page redirects anonymous users to login", async ({ page }) => {
  await page.goto("/my");

  await expect(page).toHaveURL(/\/login\?redirect=%2Fmy|\/login\?redirect=\/my/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});

test("concert list page renders with seeded or empty state", async ({ page }) => {
  await page.goto("/concerts");

  await expect(
    page.getByRole("heading", { name: "다가오는 공연" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "검색어" })).toBeVisible();
  await expect(page.getByRole("link", { name: "샘플 공연" })).toHaveAttribute(
    "href",
    "/concerts?scope=samples",
  );
  await expect(
    page
      .getByText(/등록된 공연 \d+개/)
      .or(page.getByRole("heading", { name: "등록된 공연이 없습니다" })),
  ).toBeVisible();
});

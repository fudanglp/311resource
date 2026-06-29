import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState
} from "@tanstack/react-router";
import { Boxes, Bug, Cuboid, Database, Image, Layers, Map, Mountain, Search } from "lucide-react";
import React from "react";
import ReactDOM from "react-dom/client";
import { Badge } from "./components/ui/badge";
import { cn } from "./lib/utils";
import { AssetsPage } from "./pages/AssetsPage";
import { AimgPage } from "./pages/AimgPage";
import { DebugPage } from "./pages/DebugPage";
import { MapObjectsPage } from "./pages/MapObjectsPage";
import { ModelsPage } from "./pages/ModelsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { TerrainMapPage } from "./pages/TerrainMapPage";
import { WorldMapPage } from "./pages/WorldMapPage";
import "./styles.css";

function AppLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isImmersive = pathname === "/map/3d";
  const navItems = [
    { to: "/", label: "概览", icon: Database },
    { to: "/map", label: "世界地图", icon: Map },
    { to: "/map/3d", label: "3D 世界地图", icon: Cuboid },
    { to: "/map/objects", label: "地图对象", icon: Mountain },
    { to: "/assets", label: "图像资产", icon: Image },
    { to: "/models", label: "3D 模型", icon: Cuboid },
    { to: "/aimg", label: "AIMG 覆盖", icon: Layers }
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b px-5 py-4">
            <div className="text-sm font-semibold">San11 Resource Viewer</div>
            <div className="mt-1 text-xs text-muted-foreground">本地提取结果浏览器</div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                activeProps={{
                  className: "bg-accent text-accent-foreground"
                }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <div className="px-3 pt-5 text-[11px] font-medium uppercase text-muted-foreground">后续内容</div>
            <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/70">
              <Boxes className="h-4 w-4" />
              城市 / 武将 / 特技
            </div>
          </nav>
          <div className="border-t p-3">
            <Link
              to="/debug"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
            >
              <Bug className="h-4 w-4" />
              解析线索
            </Link>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <Database className="h-4 w-4" />
            <span className="text-sm font-semibold">San11 Viewer</span>
          </div>
          <div className="hidden items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <Search className="h-3.5 w-3.5" />
            读取本地 `extracted` 与已提交分析索引
          </div>
          <Badge variant="outline" className="ml-auto">
            local only
          </Badge>
        </header>
        <main className={cn("mx-auto w-full", isImmersive ? "h-[calc(100vh-3.5rem)] max-w-none p-0" : "max-w-[1500px] px-4 py-5")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: AppLayout
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage
});

const worldMapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map",
  component: WorldMapPage
});

const terrainMapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map/3d",
  component: TerrainMapPage
});

const mapObjectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map/objects",
  component: MapObjectsPage
});

const assetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/assets",
  component: AssetsPage
});

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/models",
  component: ModelsPage
});

const aimgRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/aimg",
  component: AimgPage
});

const debugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/debug",
  component: DebugPage
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  worldMapRoute,
  terrainMapRoute,
  mapObjectsRoute,
  assetsRoute,
  modelsRoute,
  aimgRoute,
  debugRoute
]);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

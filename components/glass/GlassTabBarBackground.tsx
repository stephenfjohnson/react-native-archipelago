// Shared bottom-tab options. The bar itself is rendered by the custom
// GlassTabBar (passed via the navigator's `tabBar` prop); here we only need the
// dark scene background and hidden headers.
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";

import Theme from "../../styles/Theme";

export const glassTabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  sceneStyle: { backgroundColor: Theme.bg },
};

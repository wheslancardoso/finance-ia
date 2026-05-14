import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AuthGate from "../src/components/AuthGate";
import "../global.css";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#050505" },
            animation: 'fade_from_bottom'
          }}
        />
      </AuthGate>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

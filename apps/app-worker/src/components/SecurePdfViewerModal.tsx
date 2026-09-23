import { useEffect, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  title: string;
  base64: string | null;
  onClose: () => void;
};

type WebViewProps = {
  originWhitelist?: string[];
  source: { html: string };
  style?: object;
  startInLoadingState?: boolean;
  renderLoading?: () => React.ReactElement;
  scalesPageToFit?: boolean;
};

function buildPdfHtml(base64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #525659; overflow: hidden; }
  embed { display: block; width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>
<embed src="data:application/pdf;base64,${base64}" type="application/pdf" />
</body>
</html>`;
}

function loadWebViewComponent(): ComponentType<WebViewProps> | null {
  try {
    const module = require("react-native-webview") as {
      WebView: ComponentType<WebViewProps>;
    };
    return module.WebView;
  } catch {
    return null;
  }
}

export function SecurePdfViewerModal({ visible, title, base64, onClose }: Props) {
  const [WebViewComponent, setWebViewComponent] = useState<ComponentType<WebViewProps> | null>(
    null,
  );
  const [webViewUnavailable, setWebViewUnavailable] = useState(false);

  useEffect(() => {
    if (!visible || !base64) {
      setWebViewComponent(null);
      setWebViewUnavailable(false);
      return;
    }

    const component = loadWebViewComponent();
    if (component) {
      setWebViewComponent(() => component);
      setWebViewUnavailable(false);
      return;
    }

    setWebViewComponent(null);
    setWebViewUnavailable(true);
  }, [visible, base64]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar documento"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          >
            <Ionicons name="close" size={22} color="#0f766e" />
            <Text style={styles.closeLabel}>Cerrar</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {webViewUnavailable ? (
          <View style={styles.unavailable}>
            <Ionicons name="construct-outline" size={40} color="#64748b" />
            <Text style={styles.unavailableTitle}>Visor PDF no disponible</Text>
            <Text style={styles.unavailableText}>
              Hay que recompilar la app para incluir el visor nativo. En tu PC ejecuta:
            </Text>
            <Text style={styles.unavailableCode}>npx expo run:android</Text>
          </View>
        ) : null}

        {base64 && WebViewComponent ? (
          <WebViewComponent
            originWhitelist={["*"]}
            source={{ html: buildPdfHtml(base64) }}
            style={styles.webview}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#0f766e" />
              </View>
            )}
            scalesPageToFit
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 72,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeLabel: {
    color: "#0f766e",
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  headerSpacer: {
    minWidth: 72,
  },
  webview: {
    flex: 1,
    backgroundColor: "#525659",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#525659",
  },
  unavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  unavailableTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  unavailableText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  unavailableCode: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "monospace",
    color: "#0f766e",
    textAlign: "center",
  },
});

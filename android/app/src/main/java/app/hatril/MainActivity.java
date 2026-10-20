package app.hatril;

import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.webkit.SslErrorHandler;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge == null) {
            return;
        }
        bridge.setWebViewClient(new ClienteHatril(bridge));

        /*
         * ATRÁS EN LA PANTALLA DE SIN CONEXIÓN, SALE
         *
         * En la web, el botón lo lleva src/components/app-nativa.tsx. En la
         * pantalla de error no hay web que lo escuche, y @capacitor/app hace
         * entonces `goBack()` si puede y nada si no: o vuelve a la carga que
         * acaba de fallar, que trae otra vez aquí, o no hace nada. Las dos
         * cosas dejan a la persona atrapada.
         *
         * Se registra después que el del plugin, así que va primero; en
         * cualquier otra pantalla se aparta y le deja hacer.
         */
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    String actual = bridge.getWebView().getUrl();
                    if (actual != null && actual.equals(bridge.getErrorUrl())) {
                        finish();
                        return;
                    }
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        );
    }

    /**
     * Un certificado que no vale deja la app en blanco, sin más.
     *
     * Capacitor manda a `server.errorPath` cuando la web no responde o
     * responde con un error, pero no cuando falla el certificado: Android
     * cancela la carga y no avisa a nadie. Pasa con un reloj del teléfono mal
     * puesto, con el wifi de un hotel que intercepta, y con la dirección de
     * pruebas de traefik.me. Aquí se cancela igual y además se enseña la
     * pantalla de sin conexión, con su botón de reintentar.
     *
     * NUNCA `handler.proceed()`: eso sería aceptar cualquier certificado.
     *
     * Solo si el fallo es del propio servidor de la app. Si es de una imagen
     * de otro sitio, se pierde esa imagen y la pantalla sigue.
     */
    private static class ClienteHatril extends BridgeWebViewClient {

        private final Bridge bridge;

        ClienteHatril(Bridge bridge) {
            super(bridge);
            this.bridge = bridge;
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();

            String servidor = bridge.getServerUrl();
            String pantallaDeError = bridge.getErrorUrl();
            if (servidor == null || pantallaDeError == null || error.getUrl() == null) {
                return;
            }

            String hostServidor = Uri.parse(servidor).getHost();
            String hostFallo = Uri.parse(error.getUrl()).getHost();
            if (hostServidor != null && hostServidor.equalsIgnoreCase(hostFallo)) {
                view.loadUrl(pantallaDeError);
            }
        }
    }
}

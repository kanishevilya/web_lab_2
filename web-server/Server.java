import com.fastcgi.FCGIInterface;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.ZonedDateTime;
import java.time.ZoneOffset;

public class Server {

    public static void main(String[] args) {
        FCGIInterface fcgiInterface = new FCGIInterface();
        System.out.println("Server Started");
        while (fcgiInterface.FCGIaccept() >= 0) {
            long startTime = System.nanoTime();

            try {
                String queryString = System.getProperty("QUERY_STRING");

                if (queryString == null || queryString.isEmpty()) {
                    sendError("Missing parameters");
                    continue;
                }

                String[] params = queryString.split("&");
                String strX = null, strY = null, strR = null;

                for (String param : params) {
                    String[] pair = param.split("=");
                    if (pair.length == 2) {
                        switch (pair[0]) {
                            case "x": strX = pair[1]; break;
                            case "y": strY = pair[1]; break;
                            case "r": strR = pair[1]; break;
                        }
                    }
                }

                if (strX == null || strY == null || strR == null) {
                    sendError("Invalid parameters");
                    continue;
                }

                BigDecimal x = new BigDecimal(strX);
                BigDecimal y = new BigDecimal(strY);
                BigDecimal r = new BigDecimal(strR);

                boolean isHit = checkHit(x, y, r);

                long executionTime = System.nanoTime() - startTime;
                String currentTime = ZonedDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ISO_INSTANT);

                String jsonResponse = String.format(
                        "{\"x\": \"%s\", \"y\": \"%s\", \"r\": \"%s\", \"hit\": %b, \"currentTime\": \"%s\", \"executionTime\": %d}",
                        x.toString(), y.toString(), r.toString(), isHit, currentTime, executionTime
                );

                sendJson(jsonResponse);

            } catch (NumberFormatException e) {
                sendError("Data type mismatch. Expected numbers.");
            } catch (Exception e) {
                sendError("Internal Server Error");
            }
        }
    }

    private static boolean checkHit(BigDecimal x, BigDecimal y, BigDecimal r) {
        BigDecimal zero = BigDecimal.ZERO;

        if (x.compareTo(zero) <= 0 && y.compareTo(zero) >= 0) {
            BigDecimal twoY = y.multiply(new BigDecimal("2"));
            if (twoY.subtract(x).compareTo(r) <= 0) {
                return true;
            }
        }

        if (x.compareTo(zero) <= 0 && y.compareTo(zero) <= 0) {
            BigDecimal x2 = x.multiply(x);
            BigDecimal y2 = y.multiply(y);
            BigDecimal sum4 = x2.add(y2).multiply(new BigDecimal("4"));
            BigDecimal r2 = r.multiply(r);
            if (sum4.compareTo(r2) <= 0) {
                return true;
            }
        }

        if (x.compareTo(zero) >= 0 && y.compareTo(zero) <= 0) {
            BigDecimal twoY = y.multiply(new BigDecimal("2"));
            BigDecimal minusR = r.negate();
            if (x.compareTo(r) <= 0 && twoY.compareTo(minusR) >= 0) {
                return true;
            }
        }

        return false;
    }

    private static void sendJson(String json) {
        String httpResponse = "Content-Type: application/json\r\n" +
                "Content-Length: " + json.getBytes(StandardCharsets.UTF_8).length + "\r\n\r\n" +
                json;
        System.out.println(httpResponse);
    }

    private static void sendError(String message) {
        String json = String.format("{\"error\": \"%s\"}", message);
        String httpResponse = "Status: 400 Bad Request\r\n" +
                "Content-Type: application/json\r\n" +
                "Content-Length: " + json.getBytes(StandardCharsets.UTF_8).length + "\r\n\r\n" +
                json;
        System.out.println(httpResponse);
    }
}
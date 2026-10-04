import com.fastcgi.FCGIInterface;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

public class Server {

    public static void main(String[] args) {
        FCGIInterface fcgiInterface = new FCGIInterface();
        System.out.println("Server Started");
        while (fcgiInterface.FCGIaccept() >= 0) {
            long startTime = System.nanoTime();

            try {
                String body = readRequestBody();

                if (body == null || body.isEmpty()) {
                    sendError("Missing parameters");
                    continue;
                }

                String strX = null, strY = null, strR = null;
                String strRect = null, strTri = null, strArc = null;

                for (String param : body.split("&")) {
                    String[] pair = param.split("=", 2);
                    if (pair.length != 2) continue;
                    String key = pair[0];
                    String value = URLDecoder.decode(pair[1], "UTF-8");
                    switch (key) {
                        case "x": strX = value; break;
                        case "y": strY = value; break;
                        case "r": strR = value; break;
                        case "rect": strRect = value; break;
                        case "tri": strTri = value; break;
                        case "arc": strArc = value; break;
                    }
                }

                if (strX == null || strY == null || strR == null) {
                    sendError("Invalid parameters");
                    continue;
                }

                BigDecimal x = new BigDecimal(strX);
                BigDecimal y = new BigDecimal(strY);
                BigDecimal r = new BigDecimal(strR);

                boolean hasCustomShape = strRect != null && strTri != null && strArc != null;

                boolean isHit;
                if (hasCustomShape) {
                    double[][] rect = parsePoints(strRect);
                    double[][] tri = parsePoints(strTri);
                    double[][] arc = parsePoints(strArc);
                    isHit = checkHitCustom(x.doubleValue(), y.doubleValue(), rect, tri, arc);
                } else {
                    isHit = checkHit(x, y, r);
                }

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

    private static String readRequestBody() throws IOException {
        String method = System.getProperty("REQUEST_METHOD");

        if ("POST".equalsIgnoreCase(method)) {
            String contentLengthStr = System.getProperty("CONTENT_LENGTH");
            int contentLength = 0;
            if (contentLengthStr != null && !contentLengthStr.isEmpty()) {
                try {
                    contentLength = Integer.parseInt(contentLengthStr.trim());
                } catch (NumberFormatException ignored) {
                    contentLength = 0;
                }
            }
            if (contentLength <= 0) return "";

            byte[] buffer = new byte[contentLength];
            int totalRead = 0;
            while (totalRead < contentLength) {
                int read = System.in.read(buffer, totalRead, contentLength - totalRead);
                if (read == -1) break;
                totalRead += read;
            }
            return new String(buffer, 0, totalRead, StandardCharsets.UTF_8);
        }

        String queryString = System.getProperty("QUERY_STRING");
        return queryString == null ? "" : queryString;
    }

    private static double[][] parsePoints(String raw) {
        String[] rawPoints = raw.split(";");
        double[][] result = new double[rawPoints.length][2];
        for (int i = 0; i < rawPoints.length; i++) {
            String[] xy = rawPoints[i].split(",");
            result[i][0] = Double.parseDouble(xy[0]);
            result[i][1] = Double.parseDouble(xy[1]);
        }
        return result;
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

    private static boolean checkHitCustom(double x, double y, double[][] rect, double[][] tri, double[][] arc) {
        return pointInPolygon(x, y, rect) || pointInPolygon(x, y, tri) || pointInPolygon(x, y, arc);
    }

    private static boolean pointInPolygon(double px, double py, double[][] poly) {
        boolean inside = false;
        int n = poly.length;
        for (int i = 0, j = n - 1; i < n; j = i++) {
            double xi = poly[i][0], yi = poly[i][1];
            double xj = poly[j][0], yj = poly[j][1];
            boolean intersect = ((yi > py) != (yj > py)) &&
                    (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
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
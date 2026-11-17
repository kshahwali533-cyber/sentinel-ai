/**
 * Safe HTTP redirect handling.
 *
 * Dependencies are injected so redirect behavior can be tested without
 * making network requests. Every redirect destination is validated before
 * it is passed to the pinned request function.
 */
export function createSafeFetch({
  validateTargetURL,
  requestPinned,
  maxRedirects = 5
}) {
  if (typeof validateTargetURL !== "function" || typeof requestPinned !== "function") {
    throw new TypeError("validateTargetURL and requestPinned must be functions.");
  }

  if (!Number.isInteger(maxRedirects) || maxRedirects < 0) {
    throw new TypeError("maxRedirects must be a non-negative integer.");
  }

  async function cancelRedirectBody(response) {
    try {
      await response.body?.cancel();
    } catch {
      // A failed cleanup must not replace the redirect safety error.
    }
  }

  return async function safeFetch(startURL, options = {}) {
    let currentURL = new URL(startURL.href);
    let currentValidation = null;

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
      const validation =
        currentValidation || await validateTargetURL(currentURL);

      currentValidation = null;

      if (!validation.safe) {
        const error = new Error(validation.reason);
        error.code = "SSRF_BLOCKED";
        throw error;
      }

      const response = await requestPinned(
        currentURL,
        validation.addresses,
        options
      );

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");

        if (!location) {
          return { response, finalURL: currentURL };
        }

        if (redirectCount >= maxRedirects) {
          await cancelRedirectBody(response);
          const error = new Error(
            "The website exceeded the maximum number of redirects."
          );
          error.code = "TOO_MANY_REDIRECTS";
          throw error;
        }

        let nextURL;

        try {
          nextURL = new URL(location, currentURL.href);
        } catch {
          await cancelRedirectBody(response);
          const error = new Error(
            "The website returned an invalid redirect destination."
          );
          error.code = "INVALID_REDIRECT";
          throw error;
        }

        const nextValidation = await validateTargetURL(nextURL);

        if (!nextValidation.safe) {
          await cancelRedirectBody(response);
          const error = new Error(
            "The website redirected to a private or local destination."
          );
          error.code = "SSRF_REDIRECT_BLOCKED";
          throw error;
        }

        await cancelRedirectBody(response);
        currentURL = nextURL;
        currentValidation = nextValidation;
        continue;
      }

      return { response, finalURL: currentURL };
    }

    throw new Error(
      "Unable to safely follow the website redirects."
    );
  };
}

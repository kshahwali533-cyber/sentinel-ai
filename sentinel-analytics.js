function trackSentinelEvent(eventName, eventData = {}) {
    try {
      if (
        typeof window.va === "function"
      ) {
        window.va("event", {
          name: eventName,
          ...eventData
        });
      }
    console.log("Sentinel Analytics:", eventName, eventData);
    } catch (error) {
      console.warn(
        "Sentinel event tracking failed:",
        error
      );
    }
  }

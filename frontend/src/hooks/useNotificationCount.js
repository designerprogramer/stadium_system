import { useEffect, useState } from "react";

import API from "../lib/api";

function countUnread(items) {
  return items.reduce((count, item) => (item.is_read ? count : count + 1), 0);
}

export default function useNotificationCount(pollMs = 5000) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadCount = async () => {
      try {
        const response = await API.get("/notifications/");
        if (!isMounted) {
          return;
        }
        setUnreadCount(countUnread(response.data || []));
      } catch (error) {
        console.error("Failed to fetch notification count", error);
      }
    };

    const handleNotificationsChanged = (event) => {
      const nextCount = event.detail?.unreadCount;
      if (typeof nextCount === "number") {
        setUnreadCount(nextCount);
        return;
      }
      loadCount();
    };

    loadCount();
    window.addEventListener("notifications:changed", handleNotificationsChanged);
    const intervalId = setInterval(loadCount, pollMs);

    return () => {
      isMounted = false;
      window.removeEventListener("notifications:changed", handleNotificationsChanged);
      clearInterval(intervalId);
    };
  }, [pollMs]);

  return unreadCount;
}

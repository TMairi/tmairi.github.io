/*
 * Calculate the Timeago
 */
/*
$(function() {

  const timeagoElem = $(".timeago");

  let toRefresh = timeagoElem.length;

  let intervalId = void 0;

  function timeago(iso, preposition) {
    let now = new Date();
    let past = new Date(iso);
    let prep = (typeof preposition !== "undefined" ? `${preposition} ` : "");

    if (past.getFullYear() !== now.getFullYear()) {
      toRefresh -= 1;
      return prep + past.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }

    if (past.getMonth() !== now.getMonth()) {
      toRefresh -= 1;
      return prep + past.toLocaleString("en-US", {
        month: "short",
        day: "numeric"
      });
    }

    let seconds = Math.floor((now - past) / 1000);

    let day = Math.floor(seconds / 86400);
    if (day >= 1) {
      toRefresh -= 1;
      return day + " day" + (day > 1 ? "s" : "") + " ago";
    }

    let hour = Math.floor(seconds / 3600);
    if (hour >= 1) {
      return hour + " hour" + (hour > 1 ? "s" : "") + " ago";
    }

    let minute = Math.floor(seconds / 60);
    if (minute >= 1) {
      return minute + " minute" + (minute > 1 ? "s" : "") + " ago";
    }

    return "just now";
  }
*/
/*
  function updateTimeago() {
    $(".timeago").each(function() {
      if ($(this).children("i").length > 0) {
        let node = $(this).children("i");
        let date = node.text(); 
        $(this).text(timeago(date, $(this).attr("prep")));
        $(this).append(node);
      }
    });

    if (toRefresh === 0 && typeof intervalId !== "undefined") {
      clearInterval(intervalId); 
    }
    return toRefresh;
  }

  if (toRefresh === 0) {
    return;
  }

  if (updateTimeago() > 0) { 
    intervalId = setInterval(updateTimeago, 60000);
  }

});
*/

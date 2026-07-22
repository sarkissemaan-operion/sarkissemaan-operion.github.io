document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { links.classList.remove("open"); });
    });
  }

  var form = document.querySelector("#contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.querySelector("#form-status");
      if (status) {
        status.textContent = "Thank you — your message has been noted. We reply within one business day.";
      }
      form.reset();
    });
  }

  var year = document.querySelector("#year");
  if (year) { year.textContent = new Date().getFullYear(); }
});

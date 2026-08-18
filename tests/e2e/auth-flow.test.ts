/**
 * End-to-end browser test specification
 */

export const e2eSpecs = {
  loginFlow: {
    url: "/login",
    fields: ["email", "password"],
    submitButton: "Sign In",
    expectedRedirect: "/dashboard",
  },
  navigationFlow: {
    routes: [
      "/dashboard",
      "/students",
      "/classes",
      "/subjects",
      "/exams",
      "/marks",
      "/results",
      "/finance",
      "/reports",
      "/settings",
    ],
  },
};

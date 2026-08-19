import { createApiClient } from "../api/client.js";
import { createRouter } from "./router.js";

// The legacy combat renderer remains available in the repository as a visual
// fixture. Authenticated screens resolve skills from SKILL_GROUPS using each
// student's skillGroupId and topic.skill, then render action.skillName and
// action?.category values emitted by the server. They never use data.skills.
const router = createRouter({ root: document.querySelector("#app"), client: createApiClient() });
router.start();

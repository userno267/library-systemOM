import { spawn } from "child_process";

export const getRecommendations = (req, res) => {
  const userId = req.user.id;

  const pyExecutable = "C:\\wamp64\\www\\mobile-library\\ml_recommender\\venv\\Scripts\\python.exe";
  const recommenderPath = "C:\\wamp64\\www\\mobile-library\\ml_recommender\\recommender.py";

  console.log("Using Python:", pyExecutable);
  console.log("Script path:", recommenderPath);
  console.log("User ID:", userId);

  const pyProcess = spawn(pyExecutable, [recommenderPath, userId]);

  let data = "";
  let error = "";

  pyProcess.stdout.on("data", (chunk) => {
    console.log("PY STDOUT:", chunk.toString());
    data += chunk.toString();
  });

  pyProcess.stderr.on("data", (chunk) => {
    console.error("PY STDERR:", chunk.toString());
    error += chunk.toString();
  });

  pyProcess.on("close", (code) => {
    console.log("Python process exited with code:", code);
    if (code !== 0) {
      console.error("Python Error:", error);
      return res.status(500).json({ error: "Recommender failed", details: error });
    }

    try {
      const recommendations = JSON.parse(data);
      res.json(recommendations);
    } catch (e) {
      console.error("Parse Error:", e);
      console.error("Data from Python:", data);
      res.status(500).json({ error: "Failed to parse recommendations" });
    }
  });
};

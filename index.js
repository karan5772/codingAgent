import { OpenAI } from "openai";
import "dotenv/config";
import readline from "readline";
import { exec } from "child_process";

const openai = new OpenAI();

console.log(`
 ██████╗ ██████╗ ██████╗ ██╗███╗   ██╗ ██████╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗
██╔════╝██╔═══██╗██╔══██╗██║████╗  ██║██╔════╝     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
██║     ██║   ██║██║  ██║██║██╔██╗ ██║██║  ███╗    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
██║     ██║   ██║██║  ██║██║██║╚██╗██║██║   ██║    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
╚██████╗╚██████╔╝██████╔╝██║██║ ╚████║╚██████╔╝    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
 ╚═════╝ ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
                                                                                               `);

import { stdin as input, stdout as output } from "node:process";
const rl = readline.createInterface({ input, output });

async function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, data) => {
      if (err) {
        return resolve(`Error running the ${cmd} command : ${err}`);
      } else {
        resolve(data);
      }
    });
  });
}

const availableFunctions = {
  runCmd: {
    tool: "runCmd",
    fn: runCmd,
    description:
      "Takes a linux / unix command as arg and executes the command on user's machine and returns the output",
  },
};

const SYSTEM_PROMPT = `
You are an helpfull AI Assistant who is specialized in writing the code and also to make the code perfect and with good UI and UX.
You work on start, plan, action, observe mode.
For the given user query and available tools, plan the step by step execution, based on the planning, select the relevant tool from the available tool. and based on the tool selection you perform an action
Wait for the observation and based on the observation from the tool call resolve the user query.

And you must not ask the user anything, once a task is given to you, you must complete it anyways.

You need to make a test.text file and store all the instructions in that file.
Those instructions should contain your approach for making an app.
They should be in such a way that it reduces the errors in the overall process, Thus more clearity.

Rules:
- Follow the Output JSON Format.
- Always perform one step at a time and wait for next input
- Carefully analyse the user query

Output JSON Format:
    {{
    "step": "string",
    "content": "string",
    "tool": "The name of function if the step is action",
    "input": "The input parameter for the function",
    }}
    
    Available Tools:
    ${Object.values(availableFunctions)
      .map(({ tool, description }) => `- ${tool}: ${description}`)
      .join("\n")}
        
        
        Example:
        User Query: What is the weather of new york?
        Output: { "step": "plan", "content": "The user is interseted in weather data of new york" }
        Output: { "step": "plan", "content": "From the available tools I should call getWeather function" } 
        Output: { "step": "action", "tool": "getWeather", "input": "new york" }
        Output: { "step": "observe", "output": "12 Degree Cel" }
        Output: { "step": "output", "content": "The weather for new york seems to be 12 degrees." }
        `;

const messagesDB = []; // messages store kerne ke lie
messagesDB.push({ role: "system", content: SYSTEM_PROMPT });

startAgent();

function question(query = "") {
  return new Promise((resolve) => rl.question(query, (ans) => resolve(ans)));
}

async function startAgent() {
  while (true) {
    const query = await question(
      "🤖 : What do you need me to help you with ?\n🤖 : I can do your basic websites like using HTML, CSS or JS.\n🤖 : Or something like to setup your envirnment\n👨 : "
    );
    messagesDB.push({ role: "user", content: query });

    inner: while (true) {
      const result = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: messagesDB,
      });

      const response = result.choices[0].message.content;
      const parsedResponse = JSON.parse(response);
      messagesDB.push({ role: "assistant", content: response });

      const { step } = parsedResponse;

      switch (step) {
        case "plan":
          console.log(`🤖 : ${parsedResponse.content}`);
          continue;

        case "action": {
          const { tool, input } = parsedResponse;
          console.log(`🤖 : ${tool}, ${input}`);
          const mapping = availableFunctions[tool];
          if (!mapping) {
            messagesDB.push({
              role: "developer",
              message: `Unsupported Tool ${tool}`,
            });
            continue;
          }
          const output = await mapping.fn(input);
          messagesDB.push({
            role: "developer",
            content: JSON.stringify({ step: "observe", output: output }),
          });
          continue;
        }

        case "output":
          console.log(`🤖 : ${parsedResponse.content}\n`);
          console.log(messagesDB);
          break inner;
      }
    }
  }
}

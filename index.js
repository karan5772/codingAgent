import { OpenAI } from "openai";
import "dotenv/config";
import axios from "axios";
import readline from "readline";

const openai = new OpenAI();

console.log(` **       ** ********     **     ********** **      ** ******** *******             **       ********  ******** ****     ** **********
/**      /**/**/////     ****   /////**/// /**     /**/**///// /**////**           ****     **//////**/**///// /**/**   /**/////**/// 
/**   *  /**/**         **//**      /**    /**     /**/**      /**   /**          **//**   **      // /**      /**//**  /**    /**    
/**  *** /**/*******   **  //**     /**    /**********/******* /*******          **  //** /**         /******* /** //** /**    /**    
/** **/**/**/**////   **********    /**    /**//////**/**////  /**///**         **********/**    *****/**////  /**  //**/**    /**    
/**** //****/**      /**//////**    /**    /**     /**/**      /**  //**       /**//////**//**  ////**/**      /**   //****    /**    
/**/   ///**/********/**     /**    /**    /**     /**/********/**   //**      /**     /** //******** /********/**    //***    /**    
//       // //////// //      //     //     //      // //////// //     //       //      //   ////////  //////// //      ///     //     `);

import { stdin as input, stdout as output } from "node:process";
const rl = readline.createInterface({ input, output });

async function getWeather(city) {
  const url = `https://wttr.in/${city.toLowerCase()}?format=%C+%t`;
  const result = await axios.get(url, { responseType: "text" });
  return `The weather of ${city} is ${result.data}`;
}

const availableFunctions = {
  getWeather: {
    tool: "getWeather",
    fn: getWeather,
    description:
      "Takes city as string an input and returns the weather of that city",
  },
};

const SYSTEM_PROMPT = `
You are an helpfull AI Assistant who is specialized in resolving user query.
You work on start, plan, action, observe mode.
For the given user query and available tools, plan the step by step execution, based on the planning, select the relevant tool from the available tool. and based on the tool selection you perform an action
Wait for the observation and based on the observation from the tool call resolve the user query.

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
      "🤖 : Welcome to the Weather AI Agent \n🤖 : Which city's weather would you like to know about ?\n👨 : "
    );
    messagesDB.push({ role: "user", content: query });

    inner: while (true) {
      const result = await openai.chat.completions.create({
        model: "gpt-4.1",
        response_format: { type: "json_object" },
        messages: messagesDB,
      });

      const response = result.choices[0].message.content;
      const parsedResponse = JSON.parse(response);
      messagesDB.push({ role: "assistant", content: response });

      // console.log(messagesDB);

      const { step } = parsedResponse;

      switch (step) {
        case "plan":
          // console.log(`🤖 : ${parsedResponse.content}`);
          continue;

        case "action": {
          const { tool, input } = parsedResponse;
          const mapping = availableFunctions[tool];
          if (!mapping) {
            messagesDB.push({
              role: "developer",
              message: `Unsupported Tool ${tool}`,
            });
            continue;
          }
          const output = await mapping.fn(input); //calling the function
          messagesDB.push({
            role: "developer",
            content: JSON.stringify({ step: "observe", output: output }),
          });
          continue;
        }

        case "output":
          console.log(`🤖 : ${parsedResponse.content}\n`);
          break inner;
      }
    }
  }
}

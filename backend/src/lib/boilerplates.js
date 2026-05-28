const javaReturnType = {
  int: "int",
  intArray: "int[]",
  string: "String",
  boolean: "boolean",
};

const cppReturnType = {
  int: "int",
  intArray: "vector<int>",
  string: "string",
  boolean: "bool",
};

const defaultReturn = {
  int: "0",
  intArray: "new int[0]",
  string: '""',
  boolean: "false",
};

const cppDefaultReturn = {
  int: "0",
  intArray: "{}",
  string: '""',
  boolean: "false",
};

function getParams(question) {
  return Array.isArray(question.parameterSignature) ? question.parameterSignature : [];
}

function jsArgs(question) {
  return getParams(question).map((param) => param.name).join(", ");
}

function pythonArgs(question) {
  const params = jsArgs(question);
  return params ? `self, ${params}` : "self";
}

function javaArgs(question) {
  return getParams(question)
    .map((param) => {
      if (param.type === "intArray") return `int[] ${param.name}`;
      if (param.type === "string") return `String ${param.name}`;
      if (param.type === "boolean") return `boolean ${param.name}`;
      return `int ${param.name}`;
    })
    .join(", ");
}

function cppArgs(question) {
  return getParams(question)
    .map((param) => {
      if (param.type === "intArray") return `vector<int>& ${param.name}`;
      if (param.type === "string") return `string ${param.name}`;
      if (param.type === "boolean") return `bool ${param.name}`;
      return `int ${param.name}`;
    })
    .join(", ");
}

export function buildBoilerplates(question) {
  const returnType = question.returnType || "int";
  return {
    javascript: `function ${question.functionName}(${jsArgs(question)}) {
  // Write your solution here

}`,
    python: `class Solution:
    def ${question.functionName}(${pythonArgs(question)}):
        # Write your solution here
        pass`,
    java: `class Solution {
    public ${javaReturnType[returnType]} ${question.functionName}(${javaArgs(question)}) {
        // Write your solution here
        return ${defaultReturn[returnType]};
    }
}`,
    cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    ${cppReturnType[returnType]} ${question.functionName}(${cppArgs(question)}) {
        // Write your solution here
        return ${cppDefaultReturn[returnType]};
    }
};`,
  };
}

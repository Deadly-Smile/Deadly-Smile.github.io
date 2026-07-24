const STACKSQUEUES_PROBLEMS = [
  {
    "id": "valid-parentheses",
    "title": "Valid Parentheses",
    "category": "Stacks & Queues",
    "difficulty": "Easy",
    "tags": [
      "stack",
      "string"
    ],
    "description": "Write `isValid(s)` — `s` contains only `()[]{}`; return true if every bracket is closed by the same type in the correct order.",
    "functionName": "isValid",
    "starterCode": "function isValid(s) {\n  \n}",
    "testCases": [
      {
        "args": [
          "()"
        ],
        "expected": true
      },
      {
        "args": [
          "()[]{}"
        ],
        "expected": true
      },
      {
        "args": [
          "(]"
        ],
        "expected": false
      },
      {
        "args": [
          "([)]"
        ],
        "expected": false
      }
    ]
  },
  {
    "id": "evaluate-rpn",
    "title": "Evaluate Reverse Polish Notation",
    "category": "Stacks & Queues",
    "difficulty": "Medium",
    "tags": [
      "stack"
    ],
    "description": "Write `evalRPN(tokens)` evaluating an arithmetic expression given in Reverse Polish Notation (tokens are numbers or one of `+ - * /`, integer division truncates toward zero).",
    "functionName": "evalRPN",
    "starterCode": "function evalRPN(tokens) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            "2",
            "1",
            "+",
            "3",
            "*"
          ]
        ],
        "expected": 9
      },
      {
        "args": [
          [
            "4",
            "13",
            "5",
            "/",
            "+"
          ]
        ],
        "expected": 6
      },
      {
        "args": [
          [
            "10",
            "6",
            "9",
            "3",
            "+",
            "-11",
            "*",
            "/",
            "*",
            "17",
            "+",
            "5",
            "+"
          ]
        ],
        "expected": 22
      },
      {
        "args": [
          [
            "3",
            "4",
            "+"
          ]
        ],
        "expected": 7
      }
    ]
  },
  {
    "id": "daily-temperatures",
    "title": "Daily Temperatures",
    "category": "Stacks & Queues",
    "difficulty": "Medium",
    "tags": [
      "stack",
      "monotonic-stack"
    ],
    "description": "Write `dailyTemperatures(temps)` returning, for each day, how many days until a warmer temperature (0 if none).",
    "functionName": "dailyTemperatures",
    "starterCode": "function dailyTemperatures(temps) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            73,
            74,
            75,
            71,
            69,
            72,
            76,
            73
          ]
        ],
        "expected": [
          1,
          1,
          4,
          2,
          1,
          1,
          0,
          0
        ]
      },
      {
        "args": [
          [
            30,
            40,
            50,
            60
          ]
        ],
        "expected": [
          1,
          1,
          1,
          0
        ]
      },
      {
        "args": [
          [
            30,
            60,
            90
          ]
        ],
        "expected": [
          1,
          1,
          0
        ]
      },
      {
        "args": [
          [
            89,
            62,
            70,
            58,
            47,
            47,
            46,
            76,
            100,
            70
          ]
        ],
        "expected": [
          8,
          1,
          5,
          4,
          3,
          2,
          1,
          1,
          0,
          0
        ]
      }
    ]
  },
  {
    "id": "next-greater-element",
    "title": "Next Greater Element",
    "category": "Stacks & Queues",
    "difficulty": "Easy",
    "tags": [
      "stack",
      "monotonic-stack"
    ],
    "description": "Write `nextGreaterElement(nums)` returning, for each index, the next element to its right that is strictly greater, or `-1` if none.",
    "functionName": "nextGreaterElement",
    "starterCode": "function nextGreaterElement(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            2,
            1,
            2,
            4,
            3
          ]
        ],
        "expected": [
          4,
          2,
          4,
          -1,
          -1
        ]
      },
      {
        "args": [
          [
            1,
            2,
            3,
            4
          ]
        ],
        "expected": [
          2,
          3,
          4,
          -1
        ]
      },
      {
        "args": [
          [
            4,
            3,
            2,
            1
          ]
        ],
        "expected": [
          -1,
          -1,
          -1,
          -1
        ]
      },
      {
        "args": [
          [
            13,
            7,
            6,
            12
          ]
        ],
        "expected": [
          -1,
          12,
          12,
          -1
        ]
      }
    ]
  },
  {
    "id": "decode-string",
    "title": "Decode String",
    "category": "Stacks & Queues",
    "difficulty": "Medium",
    "tags": [
      "stack",
      "string"
    ],
    "description": "Write `decodeString(s)` decoding a run-length-ish encoded string like `k[encoded]`, where `encoded` is repeated `k` times, and encodings can nest, e.g. `\"3[a2[c]]\"` → `\"accaccacc\"`.",
    "functionName": "decodeString",
    "starterCode": "function decodeString(s) {\n  \n}",
    "testCases": [
      {
        "args": [
          "3[a2[c]]"
        ],
        "expected": "accaccacc"
      },
      {
        "args": [
          "3[a]2[bc]"
        ],
        "expected": "aaabcbc"
      },
      {
        "args": [
          "2[abc]3[cd]ef"
        ],
        "expected": "abcabccdcdcdef"
      },
      {
        "args": [
          "abc"
        ],
        "expected": "abc"
      }
    ]
  },
  {
    "id": "remove-adjacent-duplicates",
    "title": "Remove Adjacent Duplicates",
    "category": "Stacks & Queues",
    "difficulty": "Easy",
    "tags": [
      "stack",
      "string"
    ],
    "description": "Write `removeDuplicatesAdjacent(s)` that repeatedly removes adjacent pairs of equal characters until none remain, returning the final string.",
    "functionName": "removeDuplicatesAdjacent",
    "starterCode": "function removeDuplicatesAdjacent(s) {\n  \n}",
    "testCases": [
      {
        "args": [
          "abbaca"
        ],
        "expected": "ca"
      },
      {
        "args": [
          "azxxzy"
        ],
        "expected": "ay"
      },
      {
        "args": [
          "aaaaaaaa"
        ],
        "expected": ""
      },
      {
        "args": [
          "abc"
        ],
        "expected": "abc"
      }
    ]
  },
  {
    "id": "queue-using-stacks",
    "title": "Queue Simulated With Stack Operations",
    "category": "Stacks & Queues",
    "difficulty": "Medium",
    "tags": [
      "queue",
      "stack",
      "simulation"
    ],
    "description": "Write `queueUsingStacks(operations)` — `operations` is an array of `[\"push\", value]`, `[\"pop\"]`, or `[\"peek\"]` commands simulating a FIFO queue. Return an array containing the result of each `pop`/`peek` command, in order (nothing recorded for `push`).",
    "functionName": "queueUsingStacks",
    "starterCode": "function queueUsingStacks(operations) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            [
              "push",
              1
            ],
            [
              "push",
              2
            ],
            [
              "peek"
            ],
            [
              "pop"
            ],
            [
              "peek"
            ]
          ]
        ],
        "expected": [
          1,
          1,
          2
        ]
      },
      {
        "args": [
          [
            [
              "push",
              5
            ],
            [
              "pop"
            ],
            [
              "push",
              6
            ],
            [
              "push",
              7
            ],
            [
              "pop"
            ],
            [
              "pop"
            ]
          ]
        ],
        "expected": [
          5,
          6,
          7
        ]
      },
      {
        "args": [
          [
            [
              "push",
              1
            ],
            [
              "push",
              2
            ],
            [
              "push",
              3
            ]
          ]
        ],
        "expected": []
      },
      {
        "args": [
          [
            [
              "push",
              "a"
            ],
            [
              "peek"
            ],
            [
              "peek"
            ]
          ]
        ],
        "expected": [
          "a",
          "a"
        ]
      }
    ]
  },
  {
    "id": "asteroid-collision",
    "title": "Asteroid Collision",
    "category": "Stacks & Queues",
    "difficulty": "Medium",
    "tags": [
      "stack",
      "simulation"
    ],
    "description": "Write `asteroidCollision(asteroids)` — each value's sign is direction (positive right, negative left), magnitude is size. Same-size opposite-direction collisions destroy both; smaller is destroyed by larger. Return the state after all collisions resolve.",
    "functionName": "asteroidCollision",
    "starterCode": "function asteroidCollision(asteroids) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            5,
            10,
            -5
          ]
        ],
        "expected": [
          5,
          10
        ]
      },
      {
        "args": [
          [
            8,
            -8
          ]
        ],
        "expected": []
      },
      {
        "args": [
          [
            10,
            2,
            -5
          ]
        ],
        "expected": [
          10
        ]
      },
      {
        "args": [
          [
            -2,
            -1,
            1,
            2
          ]
        ],
        "expected": [
          -2,
          -1,
          1,
          2
        ]
      }
    ]
  }
];

export default STACKSQUEUES_PROBLEMS;

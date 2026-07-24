const PRACTICAL_PROBLEMS = [
  {
    "id": "flatten-array",
    "title": "Flatten Array",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "array",
      "recursion",
      "practical"
    ],
    "description": "Write `flattenArray(arr)` that fully flattens an arbitrarily nested array into a single flat array, preserving order.",
    "functionName": "flattenArray",
    "starterCode": "function flattenArray(arr) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            [
              2,
              3
            ],
            [
              4,
              [
                5,
                6,
                [
                  7
                ]
              ],
              8
            ]
          ]
        ],
        "expected": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8
        ]
      },
      {
        "args": [
          []
        ],
        "expected": []
      },
      {
        "args": [
          [
            1,
            2,
            3
          ]
        ],
        "expected": [
          1,
          2,
          3
        ]
      },
      {
        "args": [
          [
            [
              [
                [
                  1
                ]
              ]
            ],
            [
              [
                2
              ]
            ],
            3
          ]
        ],
        "expected": [
          1,
          2,
          3
        ]
      }
    ]
  },
  {
    "id": "deep-clone",
    "title": "Deep Clone",
    "category": "Practical/Real-world JS",
    "difficulty": "Medium",
    "tags": [
      "object",
      "recursion",
      "practical"
    ],
    "description": "Write `deepClone(value)` returning a deep copy of a JSON-like value (nested plain objects and arrays, plus primitives) with no shared references to the original.",
    "functionName": "deepClone",
    "starterCode": "function deepClone(value) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "a": 1,
            "b": {
              "c": [
                1,
                2,
                {
                  "d": 3
                }
              ]
            }
          }
        ],
        "expected": {
          "a": 1,
          "b": {
            "c": [
              1,
              2,
              {
                "d": 3
              }
            ]
          }
        }
      },
      {
        "args": [
          [
            1,
            2,
            [
              3,
              4
            ]
          ]
        ],
        "expected": [
          1,
          2,
          [
            3,
            4
          ]
        ]
      },
      {
        "args": [
          {}
        ],
        "expected": {}
      },
      {
        "args": [
          {
            "a": null,
            "b": "x",
            "c": [
              1,
              [
                2,
                [
                  3
                ]
              ]
            ]
          }
        ],
        "expected": {
          "a": null,
          "b": "x",
          "c": [
            1,
            [
              2,
              [
                3
              ]
            ]
          ]
        }
      }
    ]
  },
  {
    "id": "deep-equal-util",
    "title": "Deep Equal",
    "category": "Practical/Real-world JS",
    "difficulty": "Medium",
    "tags": [
      "object",
      "recursion",
      "practical"
    ],
    "description": "Write `deepEqualUtil(a, b)` returning true if two JSON-like values (nested plain objects/arrays/primitives) are deeply, structurally equal.",
    "functionName": "deepEqualUtil",
    "starterCode": "function deepEqualUtil(a, b) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "a": 1,
            "b": [
              1,
              2
            ]
          },
          {
            "a": 1,
            "b": [
              1,
              2
            ]
          }
        ],
        "expected": true
      },
      {
        "args": [
          {
            "a": 1
          },
          {
            "a": 2
          }
        ],
        "expected": false
      },
      {
        "args": [
          [
            1,
            [
              2,
              3
            ]
          ],
          [
            1,
            [
              2,
              3
            ]
          ]
        ],
        "expected": true
      },
      {
        "args": [
          {
            "a": {
              "b": 1
            }
          },
          {
            "a": {
              "b": 2
            }
          }
        ],
        "expected": false
      }
    ]
  },
  {
    "id": "flatten-object",
    "title": "Flatten Object",
    "category": "Practical/Real-world JS",
    "difficulty": "Medium",
    "tags": [
      "object",
      "practical"
    ],
    "description": "Write `flattenObject(obj)` that flattens a nested plain object into a single-level object with dot-separated key paths, e.g. `{a:{b:1,c:{d:2}}}` → `{\"a.b\":1,\"a.c.d\":2}`. Arrays are treated as leaf values (not recursed into).",
    "functionName": "flattenObject",
    "starterCode": "function flattenObject(obj) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "a": {
              "b": 1,
              "c": {
                "d": 2
              }
            }
          }
        ],
        "expected": {
          "a.b": 1,
          "a.c.d": 2
        }
      },
      {
        "args": [
          {
            "x": 1,
            "y": 2
          }
        ],
        "expected": {
          "x": 1,
          "y": 2
        }
      },
      {
        "args": [
          {}
        ],
        "expected": {}
      },
      {
        "args": [
          {
            "a": {
              "b": {
                "c": {
                  "d": 5
                }
              }
            },
            "e": [
              1,
              2
            ]
          }
        ],
        "expected": {
          "a.b.c.d": 5,
          "e": [
            1,
            2
          ]
        }
      }
    ]
  },
  {
    "id": "group-by-key",
    "title": "Group By Key",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "array",
      "object",
      "practical"
    ],
    "description": "Write `groupBy(arr, key)` grouping an array of objects by the string property name `key`, returning an object mapping each observed value to the array of matching items (original order preserved within each group).",
    "functionName": "groupBy",
    "starterCode": "function groupBy(arr, key) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            {
              "type": "fruit",
              "name": "apple"
            },
            {
              "type": "veg",
              "name": "carrot"
            },
            {
              "type": "fruit",
              "name": "banana"
            }
          ],
          "type"
        ],
        "expected": {
          "fruit": [
            {
              "type": "fruit",
              "name": "apple"
            },
            {
              "type": "fruit",
              "name": "banana"
            }
          ],
          "veg": [
            {
              "type": "veg",
              "name": "carrot"
            }
          ]
        }
      },
      {
        "args": [
          [
            {
              "n": 1
            },
            {
              "n": 2
            },
            {
              "n": 1
            }
          ],
          "n"
        ],
        "expected": {
          "1": [
            {
              "n": 1
            },
            {
              "n": 1
            }
          ],
          "2": [
            {
              "n": 2
            }
          ]
        }
      },
      {
        "args": [
          [],
          "x"
        ],
        "expected": {}
      },
      {
        "args": [
          [
            {
              "age": 20
            },
            {
              "age": 30
            },
            {
              "age": 20
            },
            {
              "age": 30
            }
          ],
          "age"
        ],
        "expected": {
          "20": [
            {
              "age": 20
            },
            {
              "age": 20
            }
          ],
          "30": [
            {
              "age": 30
            },
            {
              "age": 30
            }
          ]
        }
      }
    ]
  },
  {
    "id": "chunk-array",
    "title": "Chunk Array",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "array",
      "practical"
    ],
    "description": "Write `chunkArray(arr, size)` splitting `arr` into consecutive chunks of at most `size` elements each.",
    "functionName": "chunkArray",
    "starterCode": "function chunkArray(arr, size) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            3,
            4,
            5
          ],
          2
        ],
        "expected": [
          [
            1,
            2
          ],
          [
            3,
            4
          ],
          [
            5
          ]
        ]
      },
      {
        "args": [
          [
            1,
            2,
            3,
            4,
            5,
            6
          ],
          3
        ],
        "expected": [
          [
            1,
            2,
            3
          ],
          [
            4,
            5,
            6
          ]
        ]
      },
      {
        "args": [
          [],
          2
        ],
        "expected": []
      },
      {
        "args": [
          [
            1
          ],
          5
        ],
        "expected": [
          [
            1
          ]
        ]
      }
    ]
  },
  {
    "id": "uniq-by-key",
    "title": "Unique By Key",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "array",
      "object",
      "practical"
    ],
    "description": "Write `uniqBy(arr, key)` returning items from `arr` (array of objects) with duplicate `key` values removed, keeping the first occurrence.",
    "functionName": "uniqBy",
    "starterCode": "function uniqBy(arr, key) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            {
              "id": 1
            },
            {
              "id": 2
            },
            {
              "id": 1
            }
          ],
          "id"
        ],
        "expected": [
          {
            "id": 1
          },
          {
            "id": 2
          }
        ]
      },
      {
        "args": [
          [
            {
              "name": "a"
            },
            {
              "name": "a"
            },
            {
              "name": "b"
            }
          ],
          "name"
        ],
        "expected": [
          {
            "name": "a"
          },
          {
            "name": "b"
          }
        ]
      },
      {
        "args": [
          [],
          "id"
        ],
        "expected": []
      },
      {
        "args": [
          [
            {
              "id": 1,
              "v": "x"
            },
            {
              "id": 1,
              "v": "y"
            }
          ],
          "id"
        ],
        "expected": [
          {
            "id": 1,
            "v": "x"
          }
        ]
      }
    ]
  },
  {
    "id": "pick-keys",
    "title": "Pick Keys",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "object",
      "practical"
    ],
    "description": "Write `pick(obj, keys)` returning a new object containing only the properties in the `keys` array that exist on `obj`.",
    "functionName": "pick",
    "starterCode": "function pick(obj, keys) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "a": 1,
            "b": 2,
            "c": 3
          },
          [
            "a",
            "c"
          ]
        ],
        "expected": {
          "a": 1,
          "c": 3
        }
      },
      {
        "args": [
          {
            "a": 1
          },
          [
            "b"
          ]
        ],
        "expected": {}
      },
      {
        "args": [
          {},
          [
            "a"
          ]
        ],
        "expected": {}
      },
      {
        "args": [
          {
            "x": 1,
            "y": 2,
            "z": 3
          },
          [
            "x",
            "y",
            "z"
          ]
        ],
        "expected": {
          "x": 1,
          "y": 2,
          "z": 3
        }
      }
    ]
  },
  {
    "id": "omit-keys",
    "title": "Omit Keys",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "object",
      "practical"
    ],
    "description": "Write `omit(obj, keys)` returning a new object with all properties of `obj` except those listed in `keys`.",
    "functionName": "omit",
    "starterCode": "function omit(obj, keys) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "a": 1,
            "b": 2,
            "c": 3
          },
          [
            "b"
          ]
        ],
        "expected": {
          "a": 1,
          "c": 3
        }
      },
      {
        "args": [
          {
            "a": 1
          },
          [
            "a"
          ]
        ],
        "expected": {}
      },
      {
        "args": [
          {},
          [
            "a"
          ]
        ],
        "expected": {}
      },
      {
        "args": [
          {
            "x": 1,
            "y": 2,
            "z": 3
          },
          []
        ],
        "expected": {
          "x": 1,
          "y": 2,
          "z": 3
        }
      }
    ]
  },
  {
    "id": "array-intersection-util",
    "title": "Array Intersection",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "array",
      "practical"
    ],
    "description": "Write `arrayIntersection(a, b)` returning the unique values present in both arrays (order: first-appearance order in `a`).",
    "functionName": "arrayIntersection",
    "starterCode": "function arrayIntersection(a, b) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            3
          ],
          [
            2,
            3,
            4
          ]
        ],
        "expected": [
          2,
          3
        ]
      },
      {
        "args": [
          [
            1,
            2
          ],
          [
            3,
            4
          ]
        ],
        "expected": []
      },
      {
        "args": [
          [],
          [
            1
          ]
        ],
        "expected": []
      },
      {
        "args": [
          [
            "a",
            "b",
            "c"
          ],
          [
            "b",
            "c",
            "d"
          ]
        ],
        "expected": [
          "b",
          "c"
        ]
      }
    ]
  },
  {
    "id": "array-union-util",
    "title": "Array Union",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "array",
      "practical"
    ],
    "description": "Write `arrayUnion(a, b)` returning the unique values present in either array, in order: all of `a` first (deduped), then new values from `b`.",
    "functionName": "arrayUnion",
    "starterCode": "function arrayUnion(a, b) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2
          ],
          [
            2,
            3
          ]
        ],
        "expected": [
          1,
          2,
          3
        ]
      },
      {
        "args": [
          [],
          [
            1,
            2
          ]
        ],
        "expected": [
          1,
          2
        ]
      },
      {
        "args": [
          [
            1,
            2,
            3
          ],
          []
        ],
        "expected": [
          1,
          2,
          3
        ]
      },
      {
        "args": [
          [
            "a"
          ],
          [
            "a",
            "b"
          ]
        ],
        "expected": [
          "a",
          "b"
        ]
      }
    ]
  },
  {
    "id": "array-difference-util",
    "title": "Array Difference",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "array",
      "practical"
    ],
    "description": "Write `arrayDifference(a, b)` returning the unique values in `a` that are **not** present in `b`.",
    "functionName": "arrayDifference",
    "starterCode": "function arrayDifference(a, b) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            3
          ],
          [
            2
          ]
        ],
        "expected": [
          1,
          3
        ]
      },
      {
        "args": [
          [
            1,
            2
          ],
          [
            1,
            2
          ]
        ],
        "expected": []
      },
      {
        "args": [
          [],
          [
            1
          ]
        ],
        "expected": []
      },
      {
        "args": [
          [
            "a",
            "b",
            "c"
          ],
          [
            "b"
          ]
        ],
        "expected": [
          "a",
          "c"
        ]
      }
    ]
  },
  {
    "id": "parse-query-string",
    "title": "Parse Query String",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "string",
      "practical"
    ],
    "description": "Write `parseQueryString(str)` parsing a URL query string (no leading `?`) into a plain object of key-value pairs (values as strings, and empty string for keys with no `=value`).",
    "functionName": "parseQueryString",
    "starterCode": "function parseQueryString(str) {\n  \n}",
    "testCases": [
      {
        "args": [
          "a=1&b=2"
        ],
        "expected": {
          "a": "1",
          "b": "2"
        }
      },
      {
        "args": [
          "name=John%20Doe&age=30"
        ],
        "expected": {
          "name": "John Doe",
          "age": "30"
        }
      },
      {
        "args": [
          ""
        ],
        "expected": {}
      },
      {
        "args": [
          "flag"
        ],
        "expected": {
          "flag": ""
        }
      }
    ]
  },
  {
    "id": "format-bytes",
    "title": "Format Bytes",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "string",
      "math",
      "practical"
    ],
    "description": "Write `formatBytes(bytes)` returning a human-readable size string using B/KB/MB/GB (1024-based), rounded to 2 decimal places, e.g. `formatBytes(1536)` → `\"1.5 KB\"` (trailing `.00` dropped, trailing zero in `.50` kept as `.5`... to keep this simple: format with `Number(...)` so `1.50` renders as `1.5` and `2.00` renders as `2`).",
    "functionName": "formatBytes",
    "starterCode": "function formatBytes(bytes) {\n  \n}",
    "testCases": [
      {
        "args": [
          1536
        ],
        "expected": "1.5 KB"
      },
      {
        "args": [
          0
        ],
        "expected": "0 B"
      },
      {
        "args": [
          1048576
        ],
        "expected": "1 MB"
      },
      {
        "args": [
          500
        ],
        "expected": "500 B"
      }
    ]
  },
  {
    "id": "format-duration",
    "title": "Format Duration",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "string",
      "math",
      "practical"
    ],
    "description": "Write `formatDuration(ms)` converting milliseconds into a `\"Xh Ym Zs\"` style string, omitting any leading zero units (e.g. `65000` → `\"1m 5s\"`; `500` → `\"0s\"`).",
    "functionName": "formatDuration",
    "starterCode": "function formatDuration(ms) {\n  \n}",
    "testCases": [
      {
        "args": [
          65000
        ],
        "expected": "1m 5s"
      },
      {
        "args": [
          500
        ],
        "expected": "0s"
      },
      {
        "args": [
          3661000
        ],
        "expected": "1h 1m 1s"
      },
      {
        "args": [
          3000
        ],
        "expected": "3s"
      }
    ]
  },
  {
    "id": "get-path",
    "title": "Get Path (Object Path Getter)",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "object",
      "practical"
    ],
    "description": "Write `getPath(obj, path)` reading a dot-separated `path` like `\"a.b.c\"` out of a nested object, returning `undefined` if any part of the path is missing.",
    "functionName": "getPath",
    "starterCode": "function getPath(obj, path) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "a": {
              "b": {
                "c": 42
              }
            }
          },
          "a.b.c"
        ],
        "expected": 42
      },
      {
        "args": [
          {
            "a": {
              "b": 1
            }
          },
          "a.x"
        ]
      },
      {
        "args": [
          {},
          "a.b"
        ]
      },
      {
        "args": [
          {
            "x": 5
          },
          "x"
        ],
        "expected": 5
      }
    ]
  },
  {
    "id": "camel-case",
    "title": "To Camel Case",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "string",
      "practical"
    ],
    "description": "Write `toCamelCase(str)` converting a kebab-case or snake_case or space-separated string to camelCase, e.g. `\"hello-world\"` → `\"helloWorld\"`.",
    "functionName": "toCamelCase",
    "starterCode": "function toCamelCase(str) {\n  \n}",
    "testCases": [
      {
        "args": [
          "hello-world"
        ],
        "expected": "helloWorld"
      },
      {
        "args": [
          "my_variable_name"
        ],
        "expected": "myVariableName"
      },
      {
        "args": [
          "Some Words Here"
        ],
        "expected": "someWordsHere"
      },
      {
        "args": [
          "already"
        ],
        "expected": "already"
      }
    ]
  },
  {
    "id": "kebab-case",
    "title": "To Kebab Case",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "string",
      "practical"
    ],
    "description": "Write `toKebabCase(str)` converting a camelCase, snake_case, or space-separated string to kebab-case, e.g. `\"helloWorld\"` → `\"hello-world\"`.",
    "functionName": "toKebabCase",
    "starterCode": "function toKebabCase(str) {\n  \n}",
    "testCases": [
      {
        "args": [
          "helloWorld"
        ],
        "expected": "hello-world"
      },
      {
        "args": [
          "my_variable_name"
        ],
        "expected": "my-variable-name"
      },
      {
        "args": [
          "Some Words Here"
        ],
        "expected": "some-words-here"
      },
      {
        "args": [
          "already-kebab"
        ],
        "expected": "already-kebab"
      }
    ]
  },
  {
    "id": "capitalize-words",
    "title": "Capitalize Words",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "string",
      "practical"
    ],
    "description": "Write `capitalizeWords(str)` capitalizing the first letter of every word (space-separated), lowercasing the rest of each word.",
    "functionName": "capitalizeWords",
    "starterCode": "function capitalizeWords(str) {\n  \n}",
    "testCases": [
      {
        "args": [
          "hello world"
        ],
        "expected": "Hello World"
      },
      {
        "args": [
          "THE QUICK FOX"
        ],
        "expected": "The Quick Fox"
      },
      {
        "args": [
          ""
        ],
        "expected": ""
      },
      {
        "args": [
          "a b c"
        ],
        "expected": "A B C"
      }
    ]
  },
  {
    "id": "slugify",
    "title": "Slugify",
    "category": "Practical/Real-world JS",
    "difficulty": "Easy",
    "tags": [
      "string",
      "practical"
    ],
    "description": "Write `slugify(str)` converting a string into a URL-friendly slug: lowercase, non-alphanumeric runs replaced with a single hyphen, no leading/trailing hyphens.",
    "functionName": "slugify",
    "starterCode": "function slugify(str) {\n  \n}",
    "testCases": [
      {
        "args": [
          "Hello World!"
        ],
        "expected": "hello-world"
      },
      {
        "args": [
          "  Already--Slugged  "
        ],
        "expected": "already-slugged"
      },
      {
        "args": [
          "React & JavaScript: The Good Parts"
        ],
        "expected": "react-javascript-the-good-parts"
      },
      {
        "args": [
          "___under___score___"
        ],
        "expected": "under-score"
      }
    ]
  }
];

export default PRACTICAL_PROBLEMS;

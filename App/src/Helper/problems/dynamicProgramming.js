const DYNAMICPROGRAMMING_PROBLEMS = [
  {
    "id": "climbing-stairs",
    "title": "Climbing Stairs",
    "category": "Dynamic Programming",
    "difficulty": "Easy",
    "tags": [
      "dynamic-programming"
    ],
    "description": "Write `climbStairs(n)` — you can climb 1 or 2 steps at a time; return the number of distinct ways to reach the top of `n` stairs.",
    "functionName": "climbStairs",
    "starterCode": "function climbStairs(n) {\n  \n}",
    "testCases": [
      {
        "args": [
          2
        ],
        "expected": 2
      },
      {
        "args": [
          3
        ],
        "expected": 3
      },
      {
        "args": [
          5
        ],
        "expected": 8
      },
      {
        "args": [
          10
        ],
        "expected": 89
      }
    ]
  },
  {
    "id": "house-robber",
    "title": "House Robber",
    "category": "Dynamic Programming",
    "difficulty": "Medium",
    "tags": [
      "dynamic-programming"
    ],
    "description": "Write `rob(nums)` — each `nums[i]` is money in house `i`; you can't rob two adjacent houses. Return the maximum total you can rob.",
    "functionName": "rob",
    "starterCode": "function rob(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            3,
            1
          ]
        ],
        "expected": 4
      },
      {
        "args": [
          [
            2,
            7,
            9,
            3,
            1
          ]
        ],
        "expected": 12
      },
      {
        "args": [
          []
        ],
        "expected": 0
      },
      {
        "args": [
          [
            5
          ]
        ],
        "expected": 5
      }
    ]
  },
  {
    "id": "coin-change",
    "title": "Coin Change",
    "category": "Dynamic Programming",
    "difficulty": "Medium",
    "tags": [
      "dynamic-programming"
    ],
    "description": "Write `coinChange(coins, amount)` returning the fewest number of coins needed to make up `amount` (unlimited supply of each coin), or `-1` if impossible.",
    "functionName": "coinChange",
    "starterCode": "function coinChange(coins, amount) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            5
          ],
          11
        ],
        "expected": 3
      },
      {
        "args": [
          [
            2
          ],
          3
        ],
        "expected": -1
      },
      {
        "args": [
          [
            1
          ],
          0
        ],
        "expected": 0
      },
      {
        "args": [
          [
            1,
            3,
            4
          ],
          6
        ],
        "expected": 2
      }
    ]
  },
  {
    "id": "longest-increasing-subsequence",
    "title": "Longest Increasing Subsequence",
    "category": "Dynamic Programming",
    "difficulty": "Medium",
    "tags": [
      "dynamic-programming",
      "binary-search"
    ],
    "description": "Write `lengthOfLIS(nums)` returning the length of the longest strictly increasing subsequence.",
    "functionName": "lengthOfLIS",
    "starterCode": "function lengthOfLIS(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            10,
            9,
            2,
            5,
            3,
            7,
            101,
            18
          ]
        ],
        "expected": 4
      },
      {
        "args": [
          [
            0,
            1,
            0,
            3,
            2,
            3
          ]
        ],
        "expected": 4
      },
      {
        "args": [
          [
            7,
            7,
            7,
            7
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            1,
            3,
            6,
            7,
            9,
            4,
            10,
            5,
            6
          ]
        ],
        "expected": 6
      }
    ]
  },
  {
    "id": "unique-paths",
    "title": "Unique Paths",
    "category": "Dynamic Programming",
    "difficulty": "Medium",
    "tags": [
      "dynamic-programming"
    ],
    "description": "Write `uniquePaths(m, n)` returning the number of unique paths from the top-left to the bottom-right of an `m×n` grid, moving only right or down.",
    "functionName": "uniquePaths",
    "starterCode": "function uniquePaths(m, n) {\n  \n}",
    "testCases": [
      {
        "args": [
          3,
          7
        ],
        "expected": 28
      },
      {
        "args": [
          3,
          2
        ],
        "expected": 3
      },
      {
        "args": [
          1,
          1
        ],
        "expected": 1
      },
      {
        "args": [
          7,
          3
        ],
        "expected": 28
      }
    ]
  },
  {
    "id": "min-path-sum",
    "title": "Minimum Path Sum",
    "category": "Dynamic Programming",
    "difficulty": "Medium",
    "tags": [
      "dynamic-programming"
    ],
    "description": "Write `minPathSum(grid)` returning the minimum sum path from top-left to bottom-right of `grid`, moving only right or down.",
    "functionName": "minPathSum",
    "starterCode": "function minPathSum(grid) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            [
              1,
              3,
              1
            ],
            [
              1,
              5,
              1
            ],
            [
              4,
              2,
              1
            ]
          ]
        ],
        "expected": 7
      },
      {
        "args": [
          [
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
        ],
        "expected": 12
      },
      {
        "args": [
          [
            [
              1
            ]
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            [
              1,
              2
            ],
            [
              1,
              1
            ]
          ]
        ],
        "expected": 3
      }
    ]
  },
  {
    "id": "word-break",
    "title": "Word Break",
    "category": "Dynamic Programming",
    "difficulty": "Medium",
    "tags": [
      "dynamic-programming",
      "string"
    ],
    "description": "Write `wordBreak(s, wordDict)` returning true if `s` can be segmented into a space-separated sequence of one or more words from `wordDict` (words may be reused).",
    "functionName": "wordBreak",
    "starterCode": "function wordBreak(s, wordDict) {\n  \n}",
    "testCases": [
      {
        "args": [
          "leetcode",
          [
            "leet",
            "code"
          ]
        ],
        "expected": true
      },
      {
        "args": [
          "applepenapple",
          [
            "apple",
            "pen"
          ]
        ],
        "expected": true
      },
      {
        "args": [
          "catsandog",
          [
            "cats",
            "dog",
            "sand",
            "and",
            "cat"
          ]
        ],
        "expected": false
      },
      {
        "args": [
          "",
          [
            "a"
          ]
        ],
        "expected": true
      }
    ]
  },
  {
    "id": "max-product-subarray",
    "title": "Maximum Product Subarray",
    "category": "Dynamic Programming",
    "difficulty": "Medium",
    "tags": [
      "dynamic-programming",
      "array"
    ],
    "description": "Write `maxProduct(nums)` returning the largest product of any contiguous subarray of `nums`.",
    "functionName": "maxProduct",
    "starterCode": "function maxProduct(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            2,
            3,
            -2,
            4
          ]
        ],
        "expected": 6
      },
      {
        "args": [
          [
            -2,
            0,
            -1
          ]
        ],
        "expected": 0
      },
      {
        "args": [
          [
            -2,
            3,
            -4
          ]
        ],
        "expected": 24
      },
      {
        "args": [
          [
            0,
            2
          ]
        ],
        "expected": 2
      }
    ]
  },
  {
    "id": "triangle-min-path",
    "title": "Triangle Minimum Path Sum",
    "category": "Dynamic Programming",
    "difficulty": "Medium",
    "tags": [
      "dynamic-programming"
    ],
    "description": "Write `minimumTotal(triangle)` — `triangle` is an array of rows forming a triangle (row `i` has `i+1` elements); return the minimum path sum from the top to the bottom, moving to adjacent indices on the next row.",
    "functionName": "minimumTotal",
    "starterCode": "function minimumTotal(triangle) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            [
              2
            ],
            [
              3,
              4
            ],
            [
              6,
              5,
              7
            ],
            [
              4,
              1,
              8,
              3
            ]
          ]
        ],
        "expected": 11
      },
      {
        "args": [
          [
            [
              -10
            ]
          ]
        ],
        "expected": -10
      },
      {
        "args": [
          [
            [
              1
            ],
            [
              2,
              3
            ]
          ]
        ],
        "expected": 3
      },
      {
        "args": [
          [
            [
              1
            ],
            [
              -1,
              -2
            ]
          ]
        ],
        "expected": -1
      }
    ]
  }
];

export default DYNAMICPROGRAMMING_PROBLEMS;

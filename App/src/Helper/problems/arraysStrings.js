const ARRAYSSTRINGS_PROBLEMS = [
  {
    "id": "two-sum",
    "title": "Two Sum",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "array",
      "hash-map"
    ],
    "description": "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`, as a 2-element array in the order they appear. Assume exactly one solution exists.",
    "functionName": "twoSum",
    "starterCode": "function twoSum(nums, target) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            2,
            7,
            11,
            15
          ],
          9
        ],
        "expected": [
          0,
          1
        ]
      },
      {
        "args": [
          [
            3,
            2,
            4
          ],
          6
        ],
        "expected": [
          1,
          2
        ]
      },
      {
        "args": [
          [
            3,
            3
          ],
          6
        ],
        "expected": [
          0,
          1
        ]
      },
      {
        "args": [
          [
            -1,
            -2,
            -3,
            -4,
            -5
          ],
          -8
        ],
        "expected": [
          2,
          4
        ]
      }
    ]
  },
  {
    "id": "reverse-string",
    "title": "Reverse String",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "string",
      "two-pointers"
    ],
    "description": "Write `reverseString(s)` that reverses a string and returns the result.",
    "functionName": "reverseString",
    "starterCode": "function reverseString(s) {\n  \n}",
    "testCases": [
      {
        "args": [
          "hello"
        ],
        "expected": "olleh"
      },
      {
        "args": [
          ""
        ],
        "expected": ""
      },
      {
        "args": [
          "a"
        ],
        "expected": "a"
      },
      {
        "args": [
          "A man a plan a canal Panama"
        ],
        "expected": "amanaP lanac a nalp a nam A"
      }
    ]
  },
  {
    "id": "valid-palindrome",
    "title": "Valid Palindrome",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "string",
      "two-pointers"
    ],
    "description": "Write `isPalindrome(s)` that returns true if `s` is a palindrome considering only alphanumeric characters and ignoring case.",
    "functionName": "isPalindrome",
    "starterCode": "function isPalindrome(s) {\n  \n}",
    "testCases": [
      {
        "args": [
          "A man, a plan, a canal: Panama"
        ],
        "expected": true
      },
      {
        "args": [
          "race a car"
        ],
        "expected": false
      },
      {
        "args": [
          ""
        ],
        "expected": true
      },
      {
        "args": [
          "ab_a"
        ],
        "expected": true
      }
    ]
  },
  {
    "id": "valid-anagram",
    "title": "Valid Anagram",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "string",
      "hash-map"
    ],
    "description": "Write `isAnagram(s, t)` that returns true if `t` is an anagram of `s` (same characters, same multiplicities).",
    "functionName": "isAnagram",
    "starterCode": "function isAnagram(s, t) {\n  \n}",
    "testCases": [
      {
        "args": [
          "anagram",
          "nagaram"
        ],
        "expected": true
      },
      {
        "args": [
          "rat",
          "car"
        ],
        "expected": false
      },
      {
        "args": [
          "",
          ""
        ],
        "expected": true
      },
      {
        "args": [
          "aacc",
          "ccac"
        ],
        "expected": false
      }
    ]
  },
  {
    "id": "max-subarray",
    "title": "Maximum Subarray",
    "category": "Arrays & Strings",
    "difficulty": "Medium",
    "tags": [
      "array",
      "dynamic-programming"
    ],
    "description": "Write `maxSubArray(nums)` that returns the largest sum of any contiguous subarray (Kadane's algorithm). `nums` has at least one element.",
    "functionName": "maxSubArray",
    "starterCode": "function maxSubArray(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            -2,
            1,
            -3,
            4,
            -1,
            2,
            1,
            -5,
            4
          ]
        ],
        "expected": 6
      },
      {
        "args": [
          [
            1
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            5,
            4,
            -1,
            7,
            8
          ]
        ],
        "expected": 23
      },
      {
        "args": [
          [
            -3,
            -2,
            -1
          ]
        ],
        "expected": -1
      }
    ]
  },
  {
    "id": "rotate-array",
    "title": "Rotate Array",
    "category": "Arrays & Strings",
    "difficulty": "Medium",
    "tags": [
      "array"
    ],
    "description": "Write `rotateArray(nums, k)` that returns a new array with `nums` rotated right by `k` steps.",
    "functionName": "rotateArray",
    "starterCode": "function rotateArray(nums, k) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            3,
            4,
            5,
            6,
            7
          ],
          3
        ],
        "expected": [
          5,
          6,
          7,
          1,
          2,
          3,
          4
        ]
      },
      {
        "args": [
          [
            -1,
            -100,
            3,
            99
          ],
          2
        ],
        "expected": [
          3,
          99,
          -1,
          -100
        ]
      },
      {
        "args": [
          [
            1,
            2
          ],
          3
        ],
        "expected": [
          2,
          1
        ]
      },
      {
        "args": [
          [
            1
          ],
          5
        ],
        "expected": [
          1
        ]
      }
    ]
  },
  {
    "id": "move-zeroes",
    "title": "Move Zeroes",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "array",
      "two-pointers"
    ],
    "description": "Write `moveZeroes(nums)` that returns a new array with all zeroes moved to the end, preserving the relative order of non-zero elements.",
    "functionName": "moveZeroes",
    "starterCode": "function moveZeroes(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            0,
            1,
            0,
            3,
            12
          ]
        ],
        "expected": [
          1,
          3,
          12,
          0,
          0
        ]
      },
      {
        "args": [
          [
            0
          ]
        ],
        "expected": [
          0
        ]
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
            0,
            0,
            1
          ]
        ],
        "expected": [
          1,
          0,
          0
        ]
      }
    ]
  },
  {
    "id": "best-time-to-buy-sell-stock",
    "title": "Best Time to Buy and Sell Stock",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "array",
      "dynamic-programming"
    ],
    "description": "Write `maxProfit(prices)` — given daily stock prices, return the maximum profit from buying on one day and selling on a later day. Return 0 if no profit is possible.",
    "functionName": "maxProfit",
    "starterCode": "function maxProfit(prices) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            7,
            1,
            5,
            3,
            6,
            4
          ]
        ],
        "expected": 5
      },
      {
        "args": [
          [
            7,
            6,
            4,
            3,
            1
          ]
        ],
        "expected": 0
      },
      {
        "args": [
          [
            1,
            2
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            2,
            4,
            1
          ]
        ],
        "expected": 2
      }
    ]
  },
  {
    "id": "contains-duplicate",
    "title": "Contains Duplicate",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "array",
      "set"
    ],
    "description": "Write `containsDuplicate(nums)` that returns true if any value appears at least twice.",
    "functionName": "containsDuplicate",
    "starterCode": "function containsDuplicate(nums) {\n  \n}",
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
        "expected": true
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
        "expected": false
      },
      {
        "args": [
          []
        ],
        "expected": false
      },
      {
        "args": [
          [
            1,
            1,
            1,
            3,
            3,
            4,
            3,
            2,
            4,
            2
          ]
        ],
        "expected": true
      }
    ]
  },
  {
    "id": "product-except-self",
    "title": "Product of Array Except Self",
    "category": "Arrays & Strings",
    "difficulty": "Medium",
    "tags": [
      "array"
    ],
    "description": "Write `productExceptSelf(nums)` returning an array where each element is the product of all other elements, without using division.",
    "functionName": "productExceptSelf",
    "starterCode": "function productExceptSelf(nums) {\n  \n}",
    "testCases": [
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
          24,
          12,
          8,
          6
        ]
      },
      {
        "args": [
          [
            -1,
            1,
            0,
            -3,
            3
          ]
        ],
        "expected": [
          0,
          0,
          9,
          0,
          0
        ]
      },
      {
        "args": [
          [
            2,
            3
          ]
        ],
        "expected": [
          3,
          2
        ]
      },
      {
        "args": [
          [
            4,
            0,
            0
          ]
        ],
        "expected": [
          0,
          0,
          0
        ]
      }
    ]
  },
  {
    "id": "merge-intervals",
    "title": "Merge Intervals",
    "category": "Arrays & Strings",
    "difficulty": "Medium",
    "tags": [
      "array",
      "sorting"
    ],
    "description": "Write `mergeIntervals(intervals)` — given an array of `[start, end]` intervals, merge all overlapping intervals and return the merged array sorted by start.",
    "functionName": "mergeIntervals",
    "starterCode": "function mergeIntervals(intervals) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            [
              1,
              3
            ],
            [
              2,
              6
            ],
            [
              8,
              10
            ],
            [
              15,
              18
            ]
          ]
        ],
        "expected": [
          [
            1,
            6
          ],
          [
            8,
            10
          ],
          [
            15,
            18
          ]
        ]
      },
      {
        "args": [
          [
            [
              1,
              4
            ],
            [
              4,
              5
            ]
          ]
        ],
        "expected": [
          [
            1,
            5
          ]
        ]
      },
      {
        "args": [
          [
            [
              1,
              4
            ]
          ]
        ],
        "expected": [
          [
            1,
            4
          ]
        ]
      },
      {
        "args": [
          [
            [
              1,
              4
            ],
            [
              0,
              4
            ]
          ]
        ],
        "expected": [
          [
            0,
            4
          ]
        ]
      }
    ]
  },
  {
    "id": "longest-common-prefix",
    "title": "Longest Common Prefix",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "string"
    ],
    "description": "Write `longestCommonPrefix(strs)` that returns the longest common prefix string among an array of strings, or `\"\"` if there is none.",
    "functionName": "longestCommonPrefix",
    "starterCode": "function longestCommonPrefix(strs) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            "flower",
            "flow",
            "flight"
          ]
        ],
        "expected": "fl"
      },
      {
        "args": [
          [
            "dog",
            "racecar",
            "car"
          ]
        ],
        "expected": ""
      },
      {
        "args": [
          [
            "single"
          ]
        ],
        "expected": "single"
      },
      {
        "args": [
          [
            "ab",
            "a"
          ]
        ],
        "expected": "a"
      }
    ]
  },
  {
    "id": "run-length-encode",
    "title": "Run-Length Encode",
    "category": "Arrays & Strings",
    "difficulty": "Medium",
    "tags": [
      "string"
    ],
    "description": "Write `runLengthEncode(s)` that compresses consecutive repeated characters as `char+count` (count omitted when it's 1), e.g. `\"aaabccccd\"` → `\"a3bc4d\"`.",
    "functionName": "runLengthEncode",
    "starterCode": "function runLengthEncode(s) {\n  \n}",
    "testCases": [
      {
        "args": [
          "aaabccccd"
        ],
        "expected": "a3bc4d"
      },
      {
        "args": [
          "abc"
        ],
        "expected": "abc"
      },
      {
        "args": [
          ""
        ],
        "expected": ""
      },
      {
        "args": [
          "aabbaa"
        ],
        "expected": "a2b2a2"
      }
    ]
  },
  {
    "id": "first-unique-char",
    "title": "First Unique Character",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "string",
      "hash-map"
    ],
    "description": "Write `firstUniqChar(s)` returning the index of the first character in `s` that does not repeat, or `-1` if every character repeats.",
    "functionName": "firstUniqChar",
    "starterCode": "function firstUniqChar(s) {\n  \n}",
    "testCases": [
      {
        "args": [
          "leetcode"
        ],
        "expected": 0
      },
      {
        "args": [
          "loveleetcode"
        ],
        "expected": 2
      },
      {
        "args": [
          "aabb"
        ],
        "expected": -1
      },
      {
        "args": [
          "z"
        ],
        "expected": 0
      }
    ]
  },
  {
    "id": "group-anagrams",
    "title": "Group Anagrams",
    "category": "Arrays & Strings",
    "difficulty": "Medium",
    "tags": [
      "string",
      "hash-map"
    ],
    "description": "Write `groupAnagrams(strs)` that groups strings that are anagrams of each other. Return the groups as an array of arrays; within each group keep original order, and sort the groups by their first-appearing member's original index.",
    "functionName": "groupAnagrams",
    "starterCode": "function groupAnagrams(strs) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            "eat",
            "tea",
            "tan",
            "ate",
            "nat",
            "bat"
          ]
        ],
        "expected": [
          [
            "eat",
            "tea",
            "ate"
          ],
          [
            "tan",
            "nat"
          ],
          [
            "bat"
          ]
        ]
      },
      {
        "args": [
          [
            ""
          ]
        ],
        "expected": [
          [
            ""
          ]
        ]
      },
      {
        "args": [
          [
            "a"
          ]
        ],
        "expected": [
          [
            "a"
          ]
        ]
      },
      {
        "args": [
          [
            "bdddddddddd",
            "bbbbbbbbbbc"
          ]
        ],
        "expected": [
          [
            "bdddddddddd"
          ],
          [
            "bbbbbbbbbbc"
          ]
        ]
      }
    ]
  },
  {
    "id": "spiral-matrix",
    "title": "Spiral Matrix",
    "category": "Arrays & Strings",
    "difficulty": "Medium",
    "tags": [
      "array",
      "matrix"
    ],
    "description": "Write `spiralOrder(matrix)` returning all elements of the 2D `matrix` in clockwise spiral order, as a flat array.",
    "functionName": "spiralOrder",
    "starterCode": "function spiralOrder(matrix) {\n  \n}",
    "testCases": [
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
            ],
            [
              7,
              8,
              9
            ]
          ]
        ],
        "expected": [
          1,
          2,
          3,
          6,
          9,
          8,
          7,
          4,
          5
        ]
      },
      {
        "args": [
          [
            [
              1,
              2,
              3,
              4
            ],
            [
              5,
              6,
              7,
              8
            ],
            [
              9,
              10,
              11,
              12
            ]
          ]
        ],
        "expected": [
          1,
          2,
          3,
          4,
          8,
          12,
          11,
          10,
          9,
          5,
          6,
          7
        ]
      },
      {
        "args": [
          [
            [
              1
            ]
          ]
        ],
        "expected": [
          1
        ]
      },
      {
        "args": [
          [
            [
              1,
              2
            ],
            [
              3,
              4
            ]
          ]
        ],
        "expected": [
          1,
          2,
          4,
          3
        ]
      }
    ]
  },
  {
    "id": "rotate-matrix-90",
    "title": "Rotate Matrix 90°",
    "category": "Arrays & Strings",
    "difficulty": "Medium",
    "tags": [
      "array",
      "matrix"
    ],
    "description": "Write `rotateMatrix90(matrix)` that returns a new N×N matrix rotated 90 degrees clockwise.",
    "functionName": "rotateMatrix90",
    "starterCode": "function rotateMatrix90(matrix) {\n  \n}",
    "testCases": [
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
            ],
            [
              7,
              8,
              9
            ]
          ]
        ],
        "expected": [
          [
            7,
            4,
            1
          ],
          [
            8,
            5,
            2
          ],
          [
            9,
            6,
            3
          ]
        ]
      },
      {
        "args": [
          [
            [
              1,
              2
            ],
            [
              3,
              4
            ]
          ]
        ],
        "expected": [
          [
            3,
            1
          ],
          [
            4,
            2
          ]
        ]
      },
      {
        "args": [
          [
            [
              1
            ]
          ]
        ],
        "expected": [
          [
            1
          ]
        ]
      },
      {
        "args": [
          [
            [
              1,
              2,
              3,
              4
            ],
            [
              5,
              6,
              7,
              8
            ],
            [
              9,
              10,
              11,
              12
            ],
            [
              13,
              14,
              15,
              16
            ]
          ]
        ],
        "expected": [
          [
            13,
            9,
            5,
            1
          ],
          [
            14,
            10,
            6,
            2
          ],
          [
            15,
            11,
            7,
            3
          ],
          [
            16,
            12,
            8,
            4
          ]
        ]
      }
    ]
  },
  {
    "id": "is-subsequence",
    "title": "Is Subsequence",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "string",
      "two-pointers"
    ],
    "description": "Write `isSubsequence(s, t)` returning true if `s` is a subsequence of `t` (characters of `s` appear in `t` in the same relative order, not necessarily contiguous).",
    "functionName": "isSubsequence",
    "starterCode": "function isSubsequence(s, t) {\n  \n}",
    "testCases": [
      {
        "args": [
          "abc",
          "ahbgdc"
        ],
        "expected": true
      },
      {
        "args": [
          "axc",
          "ahbgdc"
        ],
        "expected": false
      },
      {
        "args": [
          "",
          "abc"
        ],
        "expected": true
      },
      {
        "args": [
          "abc",
          "abc"
        ],
        "expected": true
      }
    ]
  },
  {
    "id": "dedup-sorted",
    "title": "Deduplicate Sorted Array",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "array",
      "two-pointers"
    ],
    "description": "Write `dedupSorted(nums)` that returns a new array with consecutive duplicates removed from a sorted array (each distinct value kept once, order preserved).",
    "functionName": "dedupSorted",
    "starterCode": "function dedupSorted(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
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
            0,
            0,
            1,
            1,
            1,
            2,
            2,
            3,
            3,
            4
          ]
        ],
        "expected": [
          0,
          1,
          2,
          3,
          4
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
      }
    ]
  },
  {
    "id": "majority-element",
    "title": "Majority Element",
    "category": "Arrays & Strings",
    "difficulty": "Easy",
    "tags": [
      "array"
    ],
    "description": "Write `majorityElement(nums)` returning the element that appears more than `⌊n/2⌋` times. It is guaranteed such an element exists.",
    "functionName": "majorityElement",
    "starterCode": "function majorityElement(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            3,
            2,
            3
          ]
        ],
        "expected": 3
      },
      {
        "args": [
          [
            2,
            2,
            1,
            1,
            1,
            2,
            2
          ]
        ],
        "expected": 2
      },
      {
        "args": [
          [
            1
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            6,
            5,
            5
          ]
        ],
        "expected": 5
      }
    ]
  }
];

export default ARRAYSSTRINGS_PROBLEMS;

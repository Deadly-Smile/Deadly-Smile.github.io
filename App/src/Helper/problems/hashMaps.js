const HASHMAPS_PROBLEMS = [
  {
    "id": "word-frequency",
    "title": "Word Frequency",
    "category": "Hash Maps & Sets",
    "difficulty": "Easy",
    "tags": [
      "hash-map",
      "array"
    ],
    "description": "Write `wordFrequency(words)` returning an object mapping each word to how many times it appears in the `words` array.",
    "functionName": "wordFrequency",
    "starterCode": "function wordFrequency(words) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            "a",
            "b",
            "a",
            "c",
            "b",
            "a"
          ]
        ],
        "expected": {
          "a": 3,
          "b": 2,
          "c": 1
        }
      },
      {
        "args": [
          []
        ],
        "expected": {}
      },
      {
        "args": [
          [
            "x"
          ]
        ],
        "expected": {
          "x": 1
        }
      },
      {
        "args": [
          [
            "dog",
            "cat",
            "dog",
            "dog",
            "cat"
          ]
        ],
        "expected": {
          "dog": 3,
          "cat": 2
        }
      }
    ]
  },
  {
    "id": "array-intersection-unique",
    "title": "Array Intersection (Unique)",
    "category": "Hash Maps & Sets",
    "difficulty": "Easy",
    "tags": [
      "array",
      "set"
    ],
    "description": "Write `arrayIntersectionUnique(a, b)` returning the sorted array of unique values present in both `a` and `b`.",
    "functionName": "arrayIntersectionUnique",
    "starterCode": "function arrayIntersectionUnique(a, b) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            2,
            1
          ],
          [
            2,
            2
          ]
        ],
        "expected": [
          2
        ]
      },
      {
        "args": [
          [
            4,
            9,
            5
          ],
          [
            9,
            4,
            9,
            8,
            4
          ]
        ],
        "expected": [
          4,
          9
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
            1,
            2
          ]
        ],
        "expected": []
      }
    ]
  },
  {
    "id": "subarray-sum-equals-k",
    "title": "Subarray Sum Equals K",
    "category": "Hash Maps & Sets",
    "difficulty": "Medium",
    "tags": [
      "array",
      "hash-map",
      "prefix-sum"
    ],
    "description": "Write `subarraySumEqualsK(nums, k)` returning the number of contiguous subarrays whose sum equals `k`.",
    "functionName": "subarraySumEqualsK",
    "starterCode": "function subarraySumEqualsK(nums, k) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            1,
            1
          ],
          2
        ],
        "expected": 2
      },
      {
        "args": [
          [
            1,
            2,
            3
          ],
          3
        ],
        "expected": 2
      },
      {
        "args": [
          [
            1,
            -1,
            0
          ],
          0
        ],
        "expected": 3
      },
      {
        "args": [
          [
            3,
            4,
            7,
            2,
            -3,
            1,
            4,
            2
          ],
          7
        ],
        "expected": 4
      }
    ]
  },
  {
    "id": "longest-consecutive-sequence",
    "title": "Longest Consecutive Sequence",
    "category": "Hash Maps & Sets",
    "difficulty": "Medium",
    "tags": [
      "array",
      "set"
    ],
    "description": "Write `longestConsecutiveSequence(nums)` returning the length of the longest run of consecutive integers that can be formed using the numbers in `nums` (order doesn't matter).",
    "functionName": "longestConsecutiveSequence",
    "starterCode": "function longestConsecutiveSequence(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            100,
            4,
            200,
            1,
            3,
            2
          ]
        ],
        "expected": 4
      },
      {
        "args": [
          [
            0,
            3,
            7,
            2,
            5,
            8,
            4,
            6,
            0,
            1
          ]
        ],
        "expected": 9
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
            1,
            2,
            0,
            1
          ]
        ],
        "expected": 3
      }
    ]
  },
  {
    "id": "contains-nearby-duplicate",
    "title": "Contains Nearby Duplicate",
    "category": "Hash Maps & Sets",
    "difficulty": "Easy",
    "tags": [
      "array",
      "hash-map"
    ],
    "description": "Write `containsNearbyDuplicate(nums, k)` returning true if there are two equal values whose indices differ by at most `k`.",
    "functionName": "containsNearbyDuplicate",
    "starterCode": "function containsNearbyDuplicate(nums, k) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            3,
            1
          ],
          3
        ],
        "expected": true
      },
      {
        "args": [
          [
            1,
            0,
            1,
            1
          ],
          1
        ],
        "expected": true
      },
      {
        "args": [
          [
            1,
            2,
            3,
            1,
            2,
            3
          ],
          2
        ],
        "expected": false
      },
      {
        "args": [
          [
            1
          ],
          1
        ],
        "expected": false
      }
    ]
  },
  {
    "id": "isomorphic-strings",
    "title": "Isomorphic Strings",
    "category": "Hash Maps & Sets",
    "difficulty": "Easy",
    "tags": [
      "string",
      "hash-map"
    ],
    "description": "Write `isIsomorphic(s, t)` returning true if the characters in `s` can be consistently, one-to-one replaced to get `t`.",
    "functionName": "isIsomorphic",
    "starterCode": "function isIsomorphic(s, t) {\n  \n}",
    "testCases": [
      {
        "args": [
          "egg",
          "add"
        ],
        "expected": true
      },
      {
        "args": [
          "foo",
          "bar"
        ],
        "expected": false
      },
      {
        "args": [
          "paper",
          "title"
        ],
        "expected": true
      },
      {
        "args": [
          "badc",
          "baba"
        ],
        "expected": false
      }
    ]
  },
  {
    "id": "happy-number",
    "title": "Happy Number",
    "category": "Hash Maps & Sets",
    "difficulty": "Easy",
    "tags": [
      "math",
      "set"
    ],
    "description": "Write `isHappy(n)` — repeatedly replace `n` with the sum of the squares of its digits; return true if this process reaches 1, false if it loops forever without reaching 1.",
    "functionName": "isHappy",
    "starterCode": "function isHappy(n) {\n  \n}",
    "testCases": [
      {
        "args": [
          19
        ],
        "expected": true
      },
      {
        "args": [
          2
        ],
        "expected": false
      },
      {
        "args": [
          1
        ],
        "expected": true
      },
      {
        "args": [
          7
        ],
        "expected": true
      }
    ]
  },
  {
    "id": "single-number",
    "title": "Single Number",
    "category": "Hash Maps & Sets",
    "difficulty": "Easy",
    "tags": [
      "hash-map",
      "array"
    ],
    "description": "Write `singleNumber(nums)` — every element appears twice except one; return that single element.",
    "functionName": "singleNumber",
    "starterCode": "function singleNumber(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            2,
            2,
            1
          ]
        ],
        "expected": 1
      },
      {
        "args": [
          [
            4,
            1,
            2,
            1,
            2
          ]
        ],
        "expected": 4
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
            0,
            1,
            0
          ]
        ],
        "expected": 1
      }
    ]
  },
  {
    "id": "top-k-frequent",
    "title": "Top K Frequent Elements",
    "category": "Hash Maps & Sets",
    "difficulty": "Medium",
    "tags": [
      "hash-map",
      "sorting"
    ],
    "description": "Write `topKFrequent(nums, k)` returning the `k` most frequent elements. Break ties by smaller value first. Return as an array ordered by frequency (descending), then value (ascending).",
    "functionName": "topKFrequent",
    "starterCode": "function topKFrequent(nums, k) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            1,
            1,
            2,
            2,
            3
          ],
          2
        ],
        "expected": [
          1,
          2
        ]
      },
      {
        "args": [
          [
            1
          ],
          1
        ],
        "expected": [
          1
        ]
      },
      {
        "args": [
          [
            4,
            4,
            4,
            6,
            6,
            3,
            3,
            3
          ],
          2
        ],
        "expected": [
          3,
          4
        ]
      },
      {
        "args": [
          [
            5,
            5,
            3,
            3,
            1
          ],
          3
        ],
        "expected": [
          3,
          5,
          1
        ]
      }
    ]
  },
  {
    "id": "find-all-duplicates",
    "title": "Find All Duplicates",
    "category": "Hash Maps & Sets",
    "difficulty": "Medium",
    "tags": [
      "array",
      "hash-map"
    ],
    "description": "Write `findAllDuplicates(nums)` — given an array where each integer appears once or twice, return (sorted) all integers that appear twice.",
    "functionName": "findAllDuplicates",
    "starterCode": "function findAllDuplicates(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            4,
            3,
            2,
            7,
            8,
            2,
            3,
            1
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
            1,
            2
          ]
        ],
        "expected": [
          1
        ]
      },
      {
        "args": [
          [
            1
          ]
        ],
        "expected": []
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
        "expected": []
      }
    ]
  },
  {
    "id": "count-distinct-elements",
    "title": "Count Distinct Elements",
    "category": "Hash Maps & Sets",
    "difficulty": "Easy",
    "tags": [
      "set",
      "array"
    ],
    "description": "Write `countDistinct(nums)` returning the number of distinct values in `nums`.",
    "functionName": "countDistinct",
    "starterCode": "function countDistinct(nums) {\n  \n}",
    "testCases": [
      {
        "args": [
          [
            1,
            2,
            2,
            3,
            3,
            3
          ]
        ],
        "expected": 3
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
            1,
            1,
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
            3,
            2,
            1
          ]
        ],
        "expected": 5
      }
    ]
  },
  {
    "id": "group-by-remainder",
    "title": "Group By Remainder",
    "category": "Hash Maps & Sets",
    "difficulty": "Easy",
    "tags": [
      "hash-map",
      "math"
    ],
    "description": "Write `groupByRemainder(nums, k)` returning an object mapping each remainder (`0..k-1`, as a string key) to the array of numbers from `nums` with that remainder mod `k`, in original order. Omit remainders with no members.",
    "functionName": "groupByRemainder",
    "starterCode": "function groupByRemainder(nums, k) {\n  \n}",
    "testCases": [
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
        "expected": {
          "0": [
            3,
            6
          ],
          "1": [
            1,
            4
          ],
          "2": [
            2,
            5
          ]
        }
      },
      {
        "args": [
          [
            10,
            20,
            30
          ],
          5
        ],
        "expected": {
          "0": [
            10,
            20,
            30
          ]
        }
      },
      {
        "args": [
          [
            1,
            2,
            3
          ],
          10
        ],
        "expected": {
          "1": [
            1
          ],
          "2": [
            2
          ],
          "3": [
            3
          ]
        }
      },
      {
        "args": [
          [
            -1,
            -2,
            -3,
            4
          ],
          3
        ],
        "expected": {
          "0": [
            -3
          ],
          "1": [
            -2,
            4
          ],
          "2": [
            -1
          ]
        }
      }
    ]
  }
];

export default HASHMAPS_PROBLEMS;

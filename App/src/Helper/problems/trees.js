const TREES_PROBLEMS = [
  {
    "id": "tree-max-depth",
    "title": "Maximum Depth of Binary Tree",
    "category": "Trees & Basic Graphs",
    "difficulty": "Easy",
    "tags": [
      "tree",
      "recursion"
    ],
    "description": "Write `maxDepth(root)` returning the max depth of a binary tree given as `{ val, left, right }` nodes (or `null` for an empty tree/child).",
    "functionName": "maxDepth",
    "starterCode": "function maxDepth(root) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "val": 3,
            "left": {
              "val": 9,
              "left": null,
              "right": null
            },
            "right": {
              "val": 20,
              "left": {
                "val": 15,
                "left": null,
                "right": null
              },
              "right": {
                "val": 7,
                "left": null,
                "right": null
              }
            }
          }
        ],
        "expected": 3
      },
      {
        "args": [
          null
        ],
        "expected": 0
      },
      {
        "args": [
          {
            "val": 1,
            "left": null,
            "right": {
              "val": 2,
              "left": null,
              "right": null
            }
          }
        ],
        "expected": 2
      },
      {
        "args": [
          {
            "val": 1,
            "left": {
              "val": 2,
              "left": null,
              "right": null
            },
            "right": null
          }
        ],
        "expected": 2
      }
    ]
  },
  {
    "id": "tree-inorder-traversal",
    "title": "Binary Tree Inorder Traversal",
    "category": "Trees & Basic Graphs",
    "difficulty": "Easy",
    "tags": [
      "tree",
      "recursion"
    ],
    "description": "Write `inorderTraversal(root)` returning the values of a binary tree in in-order (left, node, right).",
    "functionName": "inorderTraversal",
    "starterCode": "function inorderTraversal(root) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "val": 1,
            "left": null,
            "right": {
              "val": 2,
              "left": {
                "val": 3,
                "left": null,
                "right": null
              },
              "right": null
            }
          }
        ],
        "expected": [
          1,
          3,
          2
        ]
      },
      {
        "args": [
          null
        ],
        "expected": []
      },
      {
        "args": [
          {
            "val": 1,
            "left": null,
            "right": null
          }
        ],
        "expected": [
          1
        ]
      },
      {
        "args": [
          {
            "val": 2,
            "left": {
              "val": 1,
              "left": null,
              "right": null
            },
            "right": {
              "val": 3,
              "left": null,
              "right": null
            }
          }
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
    "id": "tree-is-symmetric",
    "title": "Symmetric Tree",
    "category": "Trees & Basic Graphs",
    "difficulty": "Easy",
    "tags": [
      "tree",
      "recursion"
    ],
    "description": "Write `isSymmetric(root)` returning true if the binary tree is a mirror of itself around its center.",
    "functionName": "isSymmetric",
    "starterCode": "function isSymmetric(root) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "val": 1,
            "left": {
              "val": 2,
              "left": {
                "val": 3,
                "left": null,
                "right": null
              },
              "right": {
                "val": 4,
                "left": null,
                "right": null
              }
            },
            "right": {
              "val": 2,
              "left": {
                "val": 4,
                "left": null,
                "right": null
              },
              "right": {
                "val": 3,
                "left": null,
                "right": null
              }
            }
          }
        ],
        "expected": true
      },
      {
        "args": [
          {
            "val": 1,
            "left": {
              "val": 2,
              "left": null,
              "right": {
                "val": 3,
                "left": null,
                "right": null
              }
            },
            "right": {
              "val": 2,
              "left": null,
              "right": {
                "val": 3,
                "left": null,
                "right": null
              }
            }
          }
        ],
        "expected": false
      },
      {
        "args": [
          null
        ],
        "expected": true
      },
      {
        "args": [
          {
            "val": 1,
            "left": null,
            "right": null
          }
        ],
        "expected": true
      }
    ]
  },
  {
    "id": "tree-level-order",
    "title": "Binary Tree Level Order Traversal",
    "category": "Trees & Basic Graphs",
    "difficulty": "Medium",
    "tags": [
      "tree",
      "bfs"
    ],
    "description": "Write `levelOrder(root)` returning the node values level by level (top to bottom), each level as its own array.",
    "functionName": "levelOrder",
    "starterCode": "function levelOrder(root) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "val": 3,
            "left": {
              "val": 9,
              "left": null,
              "right": null
            },
            "right": {
              "val": 20,
              "left": {
                "val": 15,
                "left": null,
                "right": null
              },
              "right": {
                "val": 7,
                "left": null,
                "right": null
              }
            }
          }
        ],
        "expected": [
          [
            3
          ],
          [
            9,
            20
          ],
          [
            15,
            7
          ]
        ]
      },
      {
        "args": [
          null
        ],
        "expected": []
      },
      {
        "args": [
          {
            "val": 1,
            "left": null,
            "right": null
          }
        ],
        "expected": [
          [
            1
          ]
        ]
      },
      {
        "args": [
          {
            "val": 1,
            "left": {
              "val": 2,
              "left": null,
              "right": null
            },
            "right": null
          }
        ],
        "expected": [
          [
            1
          ],
          [
            2
          ]
        ]
      }
    ]
  },
  {
    "id": "tree-invert",
    "title": "Invert Binary Tree",
    "category": "Trees & Basic Graphs",
    "difficulty": "Easy",
    "tags": [
      "tree",
      "recursion"
    ],
    "description": "Write `invertTree(root)` returning the tree with every left/right child swapped, recursively.",
    "functionName": "invertTree",
    "starterCode": "function invertTree(root) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "val": 4,
            "left": {
              "val": 2,
              "left": {
                "val": 1,
                "left": null,
                "right": null
              },
              "right": {
                "val": 3,
                "left": null,
                "right": null
              }
            },
            "right": {
              "val": 7,
              "left": {
                "val": 6,
                "left": null,
                "right": null
              },
              "right": {
                "val": 9,
                "left": null,
                "right": null
              }
            }
          }
        ],
        "expected": {
          "val": 4,
          "left": {
            "val": 7,
            "left": {
              "val": 9,
              "left": null,
              "right": null
            },
            "right": {
              "val": 6,
              "left": null,
              "right": null
            }
          },
          "right": {
            "val": 2,
            "left": {
              "val": 3,
              "left": null,
              "right": null
            },
            "right": {
              "val": 1,
              "left": null,
              "right": null
            }
          }
        }
      },
      {
        "args": [
          {
            "val": 2,
            "left": {
              "val": 1,
              "left": null,
              "right": null
            },
            "right": {
              "val": 3,
              "left": null,
              "right": null
            }
          }
        ],
        "expected": {
          "val": 2,
          "left": {
            "val": 3,
            "left": null,
            "right": null
          },
          "right": {
            "val": 1,
            "left": null,
            "right": null
          }
        }
      },
      {
        "args": [
          null
        ],
        "expected": null
      },
      {
        "args": [
          {
            "val": 1,
            "left": null,
            "right": null
          }
        ],
        "expected": {
          "val": 1,
          "left": null,
          "right": null
        }
      }
    ]
  },
  {
    "id": "tree-is-valid-bst",
    "title": "Validate Binary Search Tree",
    "category": "Trees & Basic Graphs",
    "difficulty": "Medium",
    "tags": [
      "tree",
      "bst"
    ],
    "description": "Write `isValidBST(root)` returning true if the tree is a valid binary search tree (every left descendant < node < every right descendant).",
    "functionName": "isValidBST",
    "starterCode": "function isValidBST(root) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "val": 2,
            "left": {
              "val": 1,
              "left": null,
              "right": null
            },
            "right": {
              "val": 3,
              "left": null,
              "right": null
            }
          }
        ],
        "expected": true
      },
      {
        "args": [
          {
            "val": 5,
            "left": {
              "val": 1,
              "left": null,
              "right": null
            },
            "right": {
              "val": 4,
              "left": {
                "val": 3,
                "left": null,
                "right": null
              },
              "right": {
                "val": 6,
                "left": null,
                "right": null
              }
            }
          }
        ],
        "expected": false
      },
      {
        "args": [
          null
        ],
        "expected": true
      },
      {
        "args": [
          {
            "val": 1,
            "left": null,
            "right": null
          }
        ],
        "expected": true
      }
    ]
  },
  {
    "id": "tree-path-sum",
    "title": "Path Sum",
    "category": "Trees & Basic Graphs",
    "difficulty": "Easy",
    "tags": [
      "tree",
      "recursion"
    ],
    "description": "Write `hasPathSum(root, targetSum)` returning true if the tree has a root-to-leaf path whose values sum to `targetSum`.",
    "functionName": "hasPathSum",
    "starterCode": "function hasPathSum(root, targetSum) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "val": 5,
            "left": {
              "val": 4,
              "left": {
                "val": 11,
                "left": {
                  "val": 7,
                  "left": null,
                  "right": null
                },
                "right": {
                  "val": 2,
                  "left": null,
                  "right": null
                }
              },
              "right": null
            },
            "right": {
              "val": 8,
              "left": null,
              "right": null
            }
          },
          22
        ],
        "expected": true
      },
      {
        "args": [
          {
            "val": 1,
            "left": {
              "val": 2,
              "left": null,
              "right": null
            },
            "right": {
              "val": 3,
              "left": null,
              "right": null
            }
          },
          5
        ],
        "expected": false
      },
      {
        "args": [
          null,
          0
        ],
        "expected": false
      },
      {
        "args": [
          {
            "val": 1,
            "left": null,
            "right": null
          },
          1
        ],
        "expected": true
      }
    ]
  },
  {
    "id": "tree-lowest-common-ancestor",
    "title": "Lowest Common Ancestor (BST)",
    "category": "Trees & Basic Graphs",
    "difficulty": "Medium",
    "tags": [
      "tree",
      "bst"
    ],
    "description": "Write `lowestCommonAncestor(root, p, q)` for a binary **search** tree, where `p` and `q` are values known to exist in the tree — return the value of their lowest common ancestor.",
    "functionName": "lowestCommonAncestor",
    "starterCode": "function lowestCommonAncestor(root, p, q) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "val": 6,
            "left": {
              "val": 2,
              "left": {
                "val": 0,
                "left": null,
                "right": null
              },
              "right": {
                "val": 4,
                "left": {
                  "val": 3,
                  "left": null,
                  "right": null
                },
                "right": {
                  "val": 5,
                  "left": null,
                  "right": null
                }
              }
            },
            "right": {
              "val": 8,
              "left": {
                "val": 7,
                "left": null,
                "right": null
              },
              "right": {
                "val": 9,
                "left": null,
                "right": null
              }
            }
          },
          2,
          8
        ],
        "expected": 6
      },
      {
        "args": [
          {
            "val": 6,
            "left": {
              "val": 2,
              "left": {
                "val": 0,
                "left": null,
                "right": null
              },
              "right": {
                "val": 4,
                "left": {
                  "val": 3,
                  "left": null,
                  "right": null
                },
                "right": {
                  "val": 5,
                  "left": null,
                  "right": null
                }
              }
            },
            "right": {
              "val": 8,
              "left": {
                "val": 7,
                "left": null,
                "right": null
              },
              "right": {
                "val": 9,
                "left": null,
                "right": null
              }
            }
          },
          2,
          4
        ],
        "expected": 2
      },
      {
        "args": [
          {
            "val": 2,
            "left": {
              "val": 1,
              "left": null,
              "right": null
            },
            "right": null
          },
          1,
          2
        ],
        "expected": 2
      },
      {
        "args": [
          {
            "val": 5,
            "left": {
              "val": 3,
              "left": null,
              "right": null
            },
            "right": {
              "val": 8,
              "left": null,
              "right": null
            }
          },
          3,
          8
        ],
        "expected": 5
      }
    ]
  },
  {
    "id": "graph-bfs",
    "title": "BFS Traversal Order",
    "category": "Trees & Basic Graphs",
    "difficulty": "Easy",
    "tags": [
      "graph",
      "bfs"
    ],
    "description": "Write `bfsOrder(adjList, start)` — `adjList` maps each node (string key) to an array of neighbor keys/numbers; return the nodes visited in breadth-first order starting from `start`, as an array (each visited once).",
    "functionName": "bfsOrder",
    "starterCode": "function bfsOrder(adjList, start) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "0": [
              1,
              2
            ],
            "1": [
              0,
              3
            ],
            "2": [
              0
            ],
            "3": [
              1
            ]
          },
          0
        ],
        "expected": [
          0,
          1,
          2,
          3
        ]
      },
      {
        "args": [
          {
            "A": [
              "B",
              "C"
            ],
            "B": [
              "A",
              "D"
            ],
            "C": [
              "A"
            ],
            "D": [
              "B"
            ]
          },
          "A"
        ],
        "expected": [
          "A",
          "B",
          "C",
          "D"
        ]
      },
      {
        "args": [
          {
            "0": []
          },
          0
        ],
        "expected": [
          0
        ]
      },
      {
        "args": [
          {
            "1": [
              2
            ],
            "2": [
              3
            ],
            "3": [
              1
            ]
          },
          1
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
    "id": "graph-has-path",
    "title": "Graph Path Exists (DFS)",
    "category": "Trees & Basic Graphs",
    "difficulty": "Easy",
    "tags": [
      "graph",
      "dfs"
    ],
    "description": "Write `hasPathDFS(adjList, start, end)` returning true if a path exists from `start` to `end` in the (possibly disconnected) graph described by `adjList`.",
    "functionName": "hasPathDFS",
    "starterCode": "function hasPathDFS(adjList, start, end) {\n  \n}",
    "testCases": [
      {
        "args": [
          {
            "0": [
              1,
              2
            ],
            "1": [
              3
            ],
            "2": [],
            "3": []
          },
          0,
          3
        ],
        "expected": true
      },
      {
        "args": [
          {
            "0": [
              1
            ],
            "1": [
              0
            ],
            "2": [
              3
            ],
            "3": [
              2
            ]
          },
          0,
          2
        ],
        "expected": false
      },
      {
        "args": [
          {
            "A": [
              "B"
            ],
            "B": [
              "C"
            ],
            "C": []
          },
          "A",
          "C"
        ],
        "expected": true
      },
      {
        "args": [
          {
            "1": [
              2
            ],
            "2": [
              1
            ]
          },
          1,
          1
        ],
        "expected": true
      }
    ]
  }
];

export default TREES_PROBLEMS;

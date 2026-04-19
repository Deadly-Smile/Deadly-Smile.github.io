// C++ code snippets for CodeRunnerTool
const SNIPPETS_CPP = [
    {
        label: "Hello World",
        code: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`
    },
    {
        label: "Variables & Math",
        code: `#include <iostream>
using namespace std;

int main() {
    int a = 10, b = 20;

    cout << "a=" << a << ", b=" << b << endl;
    cout << "a+b=" << (a + b) << endl;
    cout << "a*b=" << (a * b) << endl;

    return 0;
}`
    },
    {
        label: "Arrays & Loops",
        code: `#include <iostream>
using namespace std;

int main() {
    int arr[] = {1, 2, 3, 4, 5};
    int sum = 0;

    for (int i = 0; i < 5; i++) {
        sum += arr[i];
    }

    cout << "Sum: " << sum << endl;
    cout << "Average: " << sum / 5.0 << endl;

    return 0;
}`
    },
    {
        label: "Functions",
        code: `#include <iostream>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    cout << "5! = " << factorial(5) << endl;
    cout << "10! = " << factorial(10) << endl;
    return 0;
}`
    },
    {
        label: "Strings",
        code: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name = "World";
    cout << "Hello, " << name << "!" << endl;

    string s = "C++";
    cout << "Length: " << s.length() << endl;

    for (char c : s) {
        cout << c << " ";
    }

    cout << endl;
    return 0;
}`
    }
];

export default SNIPPETS_CPP;

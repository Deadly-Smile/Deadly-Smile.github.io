import Video from "../assets/bg-video.mp4";
("./assets/bg-video.mp4");
import pic from "../assets/Me.jpg";
import {
  AiFillGithub,
  AiFillFacebook,
  AiFillLinkedin,
  AiTwotoneMail,
} from "react-icons/ai";
import {
  SiCplusplus,
  SiJavascript,
  SiPhp,
  SiCsharp,
  SiPython,
  SiLaravel,
  SiRedux,
  SiLeetcode,
  SiCodeforces,
  SiGeeksforgeeks,
  SiFlask,
  SiDocker,
  //   SiFastapi,
} from "react-icons/si";
import { FaJava } from "react-icons/fa";
import { BiLogoReact } from "react-icons/bi";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const Home = () => {
  localStorage.setItem("theme", "dark");
  const [theme] = useState(localStorage.getItem("theme") || "dark");
  const toggleMode = () => {
    const newTheme = "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };
  useEffect(() => {
    toggleMode();
  }, []);
  toggleMode();
  return (
    <div className="relative">
      {/* <ToggleMode /> */}
      <div className="bg-black opacity-10 h-40 rounded-b-full"></div>
      <div>
        <div className="bg-black opacity-10">
          <video className="object-fill" autoPlay muted loop src={Video} />
          {/* <video className="object-fill h" autoPlay muted loop src={Video} /> */}
        </div>
        <div className="absolute hero top-2 flex-col justify-center">
          <div className="hero text-center">
            <div className="">
              <div className="animate-custom-bounce custom-bounce w-4/5 block ml-auto mr-auto max-w-sm">
                <div className="my-8">
                  <p className="text-7xl font-thin text-lime-50">ANIK SAHA</p>
                  <p className="text-2xl text-teal-600">FULL-STACK DEVELOPER</p>
                </div>

                <img
                  src={pic}
                  className="rounded-full block ml-auto mr-auto max-w-sm"
                />
                <p className="mt-2 text-white">
                  A student of{" "}
                  <a
                    href="https://pust.ac.bd/"
                    className="hover:underline text-teal-500 hover:text-teal-300"
                  >
                    Pabna University of Science and Technology
                  </a>
                </p>
                <p className="mt-2 text-white">A enthusiastic learner 😃</p>
                <p className="mt-2 text-white">A problem solver 😎 </p>
              </div>
              <div className="mt-4 w-3/5 text-center ml-auto mr-auto mb-8">
                <p className="text-slate-50">
                  {`Hello, I'm Anik Saha, a student at the Pabna University of
                      Science and Technology, majoring in Computer Science and
                      Engineering. I'm currently in my 8th semester and eager to
                      collaborate with professionals to learn and explore the
                      fascinating world of software development.`}
                </p>
                <div className="rounded-full block ml-auto mr-auto w-3/12 my-5">
                  <ul className="flex justify-between text-4xl">
                    <li className="animate-custom-bounce custom-bounce-small">
                      <a
                        href="https://github.com/Deadly-Smile"
                        className=" hover:text-teal-300"
                      >
                        <AiFillGithub />
                      </a>
                    </li>
                    <li className="animate-custom-bounce custom-bounce-small">
                      <a
                        href="https://www.facebook.com/profile.php?id=100017344039014"
                        className=" hover:text-teal-300"
                      >
                        <AiFillFacebook />
                      </a>
                    </li>
                    <li className="animate-custom-bounce custom-bounce-small">
                      <a
                        href="https://www.linkedin.com/in/anik-saha-cse-pust/"
                        className=" hover:text-teal-300"
                      >
                        <AiFillLinkedin />
                      </a>
                    </li>
                  </ul>
                </div>

                <div className="my-4">
                  <p className="text-5xl font-thin text-lime-50 my-6">SKILLS</p>
                  <div className="block ml-auto mr-auto w-4/12 h-1 bg-slate-400 rounded-md" />
                  <p className="text-3xl font-thin text-lime-50 mt-4">
                    {/* Programming Languages */}
                    PROGRAMMING LANGUAGES
                  </p>
                  <div className="rounded-full block ml-auto mr-auto w-7/12 my-6">
                    <ul className="flex justify-between text-4xl">
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="C++"
                      >
                        <a
                          href="https://isocpp.org/"
                          className="hover:text-teal-300"
                        >
                          <SiCplusplus />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="Java"
                      >
                        <a
                          href="https://www.java.com"
                          className="hover:text-teal-300"
                        >
                          <FaJava />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="Javascript"
                      >
                        <a
                          href="https://developer.mozilla.org/en-US/docs/Web/javascript"
                          className="hover:text-teal-300"
                        >
                          <SiJavascript />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="PHP"
                      >
                        <a
                          href="https://www.php.net/"
                          className="hover:text-teal-300"
                        >
                          <SiPhp />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="C#"
                      >
                        <a
                          href="https://dotnet.microsoft.com/en-us/languages/csharp"
                          className="hover:text-teal-300"
                        >
                          <SiCsharp />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="Python"
                      >
                        <a
                          href="https://www.python.org/"
                          className="hover:text-teal-300"
                        >
                          <SiPython />
                        </a>
                      </li>
                    </ul>
                  </div>
                  <p className="text-3xl font-thin text-lime-50">
                    {/* Problem Solving */}
                    PROBLEM SOLVING
                  </p>
                  <div className="rounded-full block ml-auto mr-auto w-3/12 my-6">
                    <ul className="flex justify-between text-4xl">
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="Codeforces"
                      >
                        <a
                          href="https://codeforces.com/profile/Deadly_Smile"
                          className="hover:text-teal-300"
                        >
                          <SiCodeforces />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="LeetCode"
                      >
                        <a
                          href="https://leetcode.com/Serious_Noob/"
                          className="hover:text-teal-300"
                        >
                          <SiLeetcode />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="Redux"
                      >
                        <a
                          href="https://auth.geeksforgeeks.org/user/aniksaha200r/"
                          className="hover:text-teal-300"
                        >
                          <SiGeeksforgeeks />
                        </a>
                      </li>
                    </ul>
                  </div>
                  <p className="text-3xl font-thin text-lime-50">
                    {/* Library */}
                    TOOLS
                  </p>
                  <div className="rounded-full block ml-auto mr-auto w-4/12 my-6">
                    <ul className="flex justify-between text-4xl">
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="React"
                      >
                        <a
                          href="https://react.dev/"
                          className="hover:text-teal-300"
                        >
                          <BiLogoReact />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="Laravel"
                      >
                        <a
                          href="https://laravel.com/"
                          className="hover:text-teal-300"
                        >
                          <SiLaravel />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="Redux"
                      >
                        <a
                          href="https://redux.js.org/"
                          className="hover:text-teal-300"
                        >
                          <SiRedux />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="Flask"
                      >
                        <a
                          href="https://flask.palletsprojects.com/en/3.0.x/"
                          className="hover:text-teal-300"
                        >
                          <SiFlask />
                        </a>
                      </li>
                      <li
                        className="animate-custom-bounce custom-bounce-small"
                        title="Docker"
                      >
                        <a
                          href="https://www.docker.com/"
                          className="hover:text-teal-300"
                        >
                          <SiDocker />
                        </a>
                      </li>
                    </ul>
                  </div>
                  <div className="flex justify-center">
                    <button className="btn btn-outline btn-success btn-wide font-thin text-2xl shadow-ping">
                      <Link to={"/white-board"}>Drawing Board</Link>
                    </button>
                  </div>
                </div>
              </div>
              <footer className="footer items-center p-4 bg-neutral text-neutral-content">
                <aside className="items-center grid-flow-col">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    fillRule="evenodd"
                    clipRule="evenodd"
                    className="fill-current"
                  >
                    <path d="M22.672 15.226l-2.432.811.841 2.515c.33 1.019-.209 2.127-1.23 2.456-1.15.325-2.148-.321-2.463-1.226l-.84-2.518-5.013 1.677.84 2.517c.391 1.203-.434 2.542-1.831 2.542-.88 0-1.601-.564-1.86-1.314l-.842-2.516-2.431.809c-1.135.328-2.145-.317-2.463-1.229-.329-1.018.211-2.127 1.231-2.456l2.432-.809-1.621-4.823-2.432.808c-1.355.384-2.558-.59-2.558-1.839 0-.817.509-1.582 1.327-1.846l2.433-.809-.842-2.515c-.33-1.02.211-2.129 1.232-2.458 1.02-.329 2.13.209 2.461 1.229l.842 2.515 5.011-1.677-.839-2.517c-.403-1.238.484-2.553 1.843-2.553.819 0 1.585.509 1.85 1.326l.841 2.517 2.431-.81c1.02-.33 2.131.211 2.461 1.229.332 1.018-.21 2.126-1.23 2.456l-2.433.809 1.622 4.823 2.433-.809c1.242-.401 2.557.484 2.557 1.838 0 .819-.51 1.583-1.328 1.847m-8.992-6.428l-5.01 1.675 1.619 4.828 5.011-1.674-1.62-4.829z"></path>
                  </svg>
                  <p>Copyright © 2023 Anik Saha - All right reserved</p>
                </aside>
                <nav className="grid-flow-col gap-4 md:place-self-center md:justify-self-end text-4xl">
                  <a
                    className="hover:text-teal-300 animate-custom-bounce custom-bounce-small"
                    href="mailto:aniksaha200r@gmail.com"
                  >
                    <AiTwotoneMail />
                  </a>
                  <a
                    href="https://github.com/Deadly-Smile"
                    className=" hover:text-teal-300 animate-custom-bounce custom-bounce-small"
                  >
                    <AiFillGithub />
                  </a>
                  <a
                    href="https://www.facebook.com/profile.php?id=100017344039014"
                    className=" hover:text-teal-300 animate-custom-bounce custom-bounce-small"
                  >
                    <AiFillFacebook />
                  </a>
                  <a
                    href="https://www.linkedin.com/in/anik-saha-006698294/"
                    className=" hover:text-teal-300 animate-custom-bounce custom-bounce-small"
                  >
                    <AiFillLinkedin />
                  </a>
                </nav>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

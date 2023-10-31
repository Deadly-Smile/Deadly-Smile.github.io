import Video from "./assets/bg-video.mp4";
import pic from "./assets/Me.jpg";
import {
  AiFillGithub,
  AiFillFacebook,
  AiFillLinkedin,
  // AiTwotoneMail,
} from "react-icons/ai";
import {
  SiCplusplus,
  SiJavascript,
  SiPhp,
  SiCsharp,
  SiPython,
  SiLaravel,
  SiRedux,
} from "react-icons/si";
import { FaJava } from "react-icons/fa";
import { BiLogoReact } from "react-icons/bi";
const App = () => {
  return (
    <div className="relative">
      {/* <ToggleMode /> */}
      <div className="bg-black opacity-10 h-40 rounded-b-full"></div>
      <div>
        <div className="bg-black opacity-10">
          <video className="object-fill" autoPlay muted loop src={Video} />
        </div>
        <div className="absolute hero top-2 flex-col justify-center">
          <div className="hero text-center">
            <div className="w-4/5">
              <div className="animate-custom-bounce custom-bounce">
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
                <p className="mt-2 text-white">A problem solver 😎 | He/Him</p>
              </div>
              <div className="mt-4 w-3/5 text-center ml-auto mr-auto">
                <p className="text-slate-50">
                  {`Hello, I'm Anik Saha, a student at the Pabna University of
                  Science and Technology, majoring in Computer Science and
                  Engineering. I'm currently in my 7th semester and eager to
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
                        href="https://www.linkedin.com/in/anik-saha-006698294/"
                        className=" hover:text-teal-300"
                      >
                        <AiFillLinkedin />
                      </a>
                    </li>
                    {/* <li className="animate-custom-bounce custom-bounce-small">
                      <a
                        href="https://www.mailto:aniksaha200r@gmail.com"
                        className=" hover:text-teal-300"
                      >
                        <AiTwotoneMail />
                      </a>
                    </li> */}
                  </ul>
                </div>

                <div className="my-8">
                  <p className="text-5xl font-thin text-lime-50">Skills</p>
                  <p className="text-3xl font-thin text-lime-50 mt-4">
                    Programming Languages
                  </p>
                  <div className="rounded-full block ml-auto mr-auto w-8/12 my-6">
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
                  <p className="text-3xl font-thin text-lime-50">Library</p>
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
                    </ul>
                  </div>
                  <a
                    className="btn btn-outline btn-success btn-wide font-thin text-2xl shadow-ping"
                    href="mailto:aniksaha200r@gmail.com"
                  >
                    MAIL ME
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

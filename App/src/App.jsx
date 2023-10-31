import Video from "./assets/bg-video.mp4";
import pic from "./assets/Me.png";
import {
  AiFillGithub,
  AiFillFacebook,
  AiFillLinkedin,
  AiTwotoneMail,
} from "react-icons/ai";
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
            <div className="max-w-fit">
              <div className="animate-custom-bounce custom-bounce">
                <div className="my-8">
                  <p className="text-7xl font-thin text-lime-50">ANIK SAHA</p>
                  <p className="text-2xl text-teal-600">FULL-STACK DEVELOPER</p>
                </div>

                <img
                  src={pic}
                  className="rounded-full block ml-auto mr-auto "
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
                <div className="rounded-full block ml-auto mr-auto w-4/12 my-3">
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
                    <li className="animate-custom-bounce custom-bounce-small">
                      <a
                        href="https://www.mailto:aniksaha200r@gmail.com"
                        className=" hover:text-teal-300"
                      >
                        <AiTwotoneMail />
                      </a>
                    </li>
                  </ul>
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

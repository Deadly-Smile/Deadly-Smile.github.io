import React, { useState } from "react";

const sampleProjects = [
  {
    id: 1,
    title: "Get Help",
    type: "Personal Project",
    role: "Full-Stack Developer",
    tech: ["Laravel", "React", "Redux", "Pusher"],
    features: [
      "Doctors can write blogs",
      "Users can self-educate or connect with doctors to seek help",
      "Real-time messaging and video meetings",
      "Donation system",
      "Admin panel for management"
    ],
    experience:
      "This was my first full-stack project using React and Laravel. I learned a lot during development. I even presented it at a few conferences and received positive feedback. While I made several mistakes early on, they helped me understand better practices. Overall, it was a valuable learning experience.",
    github: "https://github.com/Deadly-Smile/Get-Help",
    live: ""
  },
  {
    id: 2,
    title: "E-commerce Platform",
    tech: ["Laravel", "React", "Inertia.js", "MySQL"],
    features: [
      "Multi-category product support",
      "Admin dashboard",
      "Stripe payment integration",
    ],
    experience: "Built a scalable backend and intuitive UI. Gained experience with authentication and REST APIs.",
  },
  // Add more projects here
];

const Projects = () => {
  const [selectedProject, setSelectedProject] = useState(null);
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-20">
      <h1 className="text-4xl font-bold text-center mb-10">My Projects</h1>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {sampleProjects.map((project) => (
          <div
            key={project.id}
            className="bg-base-200 rounded-xl shadow-md p-6 hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold mb-2">{project.title}</h2>
            {/* <p className="text-sm font-medium mb-1">Tech Used:</p> */}
            <ul className="flex flex-wrap gap-2 text-sm mb-3">
              {project.tech.map((tech, i) => (
                <li key={i} className="bg-teal-800 text-slate-300 hover:text-bold hover:text-slate-100 hover:bg-teal-900 px-2 py-1 rounded">{tech}</li>
              ))}
            </ul>
            {/* <button
              onClick={() => setSelectedProject(project)}
              className="mt-2 text-sm text-slate-300 hover:bg-teal-900 px-4 py-2 rounded-full border border-teal-400"
            >
              View Details
            </button> */}
            <button
                className="btn btn-ghost hover:bg-teal-700 text-slate-200 btn-sm"
                onClick={() => {
                    setSelectedProject(project);
                    document.getElementById("modal").showModal();
                }}
                >
                View Details
            </button>
          </div>
        ))}
      </div>

      {selectedProject && <dialog id="modal" className="modal">
        <div className="modal-box max-w-2xl relative">
          {/* Close Button */}
          <button
            onClick={() => {
              document.getElementById("modal").close();
              setSelectedProject(null);
            }}
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            aria-label="Close modal"
          >
            ✕
          </button>

          {/* Title */}
          <h2 className="text-3xl font-bold mb-2">{selectedProject.title}</h2>
          <p className="text-sm mb-4">
            <span className="font-medium">{selectedProject.type}</span> • {selectedProject.role}
          </p>

          {/* Tech Used */}
          <div className="mb-4">
            <h3 className="text font-semibold">Tech Used:</h3>
            <ul className="flex flex-wrap gap-2 text-sm mt-1">
              {selectedProject.tech.map((tech, i) => (
                <li key={i} className="bg-base-200 px-3 py-1 rounded-full shadow-sm">
                  {tech}
                </li>
              ))}
            </ul>
          </div>

          {/* Features */}
          <div className="mb-4">
            <h3 className="text font-semibold">Features:</h3>
            <ul className="list-disc list-inside text-sm mt-1">
              {selectedProject.features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>
          </div>

          {/* Experience */}
          <div className="mb-4">
            <h3 className="text font-semibold">Experience:</h3>
            <p className="text-sm mt-1 leading-relaxed">
              {selectedProject.experience}
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-3 mt-6">
            {selectedProject.github && (
              <a
                href={selectedProject.github}
                target="_blank"
                rel="noopener noreferrer"
                className="btn hover:bg-teal-700 text-slate-200 btn-outline btn-sm"
              >
                GitHub
              </a>
            )}
            {selectedProject.live && (
              <a
                href={selectedProject.live}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost hover:bg-teal-700 text-slate-200 btn-sm"
              >
                Live Site
              </a>
            )}
          </div>
        </div>
      </dialog>}
    </div>
  );
};

export default Projects;

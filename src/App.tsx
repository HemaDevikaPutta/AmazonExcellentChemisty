import { useState, ChangeEvent } from "react";
import pdfjs from "pdfjs-dist";
import mammoth from "mammoth";
import "./App.css";

interface Resume {
  name: string;
  skills: string[];
  experience: string;
  confidence: number;
  contactInfo: {
    email: string;
    phone: string;
  };
  softSkills?: {
    communication: number;
    leadership: number;
    teamwork: number;
    problemSolving: number;
    adaptability: number;
  };
}

interface JobRequirements {
  requiredSkills: string[];
  minimumExperience: number;
}

interface ParseError {
  fileName: string;
  error: string;
}

// Define skill database
const skillDatabase = {
  frontend: {
    keywords: [
      "React",
      "Angular",
      "Vue",
      "JavaScript",
      "TypeScript",
      "HTML",
      "CSS",
    ],
    variations: {
      React: ["ReactJS", "React.js"],
      JavaScript: ["JS", "ECMAScript"],
      TypeScript: ["TS"],
    },
  },
  backend: {
    keywords: ["Node.js", "Python", "Java", "C#", "PHP", "Ruby"],
    variations: {
      "Node.js": ["NodeJS", "Node"],
      Python: ["Python3", "Django", "Flask"],
      Ruby: ["Ruby on Rails", "RoR"],
    },
  },
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<"screening" | "softSkills">(
    "screening",
  );
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [jobRequirements, setJobRequirements] = useState<JobRequirements>({
    requiredSkills: ["React", "TypeScript", "Node.js"],
    minimumExperience: 2,
  });
  const [isEditingRequirements, setIsEditingRequirements] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [newExperience, setNewExperience] = useState<number>(2);

  const softSkillsPatterns = {
    communication: [
      "communicate",
      "present",
      "write",
      "speak",
      "articulate",
      "collaborate",
      "correspond",
      "negotiate",
      "facilitate",
    ],
    leadership: [
      "lead",
      "manage",
      "direct",
      "supervise",
      "guide",
      "mentor",
      "coordinate",
      "oversee",
      "spearhead",
    ],
    teamwork: [
      "team",
      "collaborate",
      "cooperate",
      "partner",
      "contribute",
      "support",
      "assist",
      "participate",
    ],
    problemSolving: [
      "solve",
      "analyze",
      "improve",
      "optimize",
      "troubleshoot",
      "debug",
      "resolve",
      "enhance",
      "innovate",
    ],
    adaptability: [
      "adapt",
      "flexible",
      "adjust",
      "learn",
      "versatile",
      "dynamic",
      "agile",
      "responsive",
      "pivot",
    ],
  };

  const analyzeSoftSkills = (text: string) => {
    const textLower = text.toLowerCase();
    const scores: Record<string, number> = {};

    Object.entries(softSkillsPatterns).forEach(([skill, patterns]) => {
      const matches = patterns.reduce((count, pattern) => {
        const regex = new RegExp(`\\b${pattern}\\w*\\b`, "gi");
        const matches = textLower.match(regex);
        return count + (matches ? matches.length : 0);
      }, 0);
      scores[skill] = Math.min((matches / patterns.length) * 100, 100);
    });

    return scores;
  };

  const extractContactInfo = (text: string) => {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const phoneRegex = /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g;

    const emails = text.match(emailRegex) || [];
    const phones = text.match(phoneRegex) || [];

    return {
      email: emails[0] || "",
      phone: phones[0] || "",
    };
  };

  const parseResume = async (file: File): Promise<string> => {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    try {
      switch (fileExtension) {
        case "pdf":
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument(arrayBuffer).promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items
              .map((item: any) => item.str)
              .join(" ");
          }
          return fullText;

        case "docx":
          const docxArrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({
            arrayBuffer: docxArrayBuffer,
          });
          return result.value;

        case "txt":
          return await file.text();

        default:
          throw new Error(`Unsupported file format: ${fileExtension}`);
      }
    } catch (error:any) {
      throw new Error(`Error parsing ${file.name}: ${error.message}`);
    }
  };

  const detectSkills = (
    text: string,
  ): { skills: string[]; confidence: number } => {
    const detectedSkills = new Set<string>();
    let matchCount = 0;
    const textLower = text.toLowerCase();

    Object.values(skillDatabase).forEach((category) => {
      category.keywords.forEach((skill) => {
        if (textLower.includes(skill.toLowerCase())) {
          detectedSkills.add(skill);
          matchCount++;
        }
         
        const variations = category.variations[skill as keyof typeof category.variations]as [];
        variations.forEach((variation:any) => {
          if (textLower.includes(variation.toLowerCase())) {
            detectedSkills.add(skill);
            matchCount++;
          }
        });
      });
    });

    const confidence = Math.min((matchCount / 5) * 100, 100);

    return {
      skills: Array.from(detectedSkills),
      confidence,
    };
  };

  const handleResumeUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsLoading(true);
    setErrors([]);
    const newErrors: ParseError[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await parseResume(file);
        const { skills, confidence } = detectSkills(text);
        const contactInfo = extractContactInfo(text);
        const softSkills = analyzeSoftSkills(text);

        const resume: Resume = {
          name: file.name.split(".")[0],
          skills,
          experience: text.substring(0, 100),
          confidence,
          contactInfo,
          softSkills: softSkills as Resume["softSkills"],
        };

        setResumes((prev) => [...prev, resume]);
      } catch (error:any) {
        newErrors.push({
          fileName: file.name,
          error: error.message,
        });
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
    }
    setIsLoading(false);
  };

  const calculateMatch = (resume: Resume): number => {
    const skillMatch = resume.skills.filter((skill) =>
      jobRequirements.requiredSkills.includes(skill),
    ).length;
    const baseScore =
      (skillMatch / jobRequirements.requiredSkills.length) * 100;
    return baseScore * (resume.confidence / 100);
  };

  const renderSkillScore = (score: number) => {
    return (
      <div className="skill-score" style={{ width: `${score}%` }}>
        {score.toFixed(1)}%
      </div>
    );
  };

  return (
    <main className="container">
      <h1>AI Resume Screening</h1>

      <div className="upload-section">
        <h2>Upload Resumes</h2>
        <input
          type="file"
          accept=".txt,.pdf,.doc,.docx"
          multiple
          onChange={handleResumeUpload}
          className="file-input"
          disabled={isLoading}
        />
        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Processing resumes...</p>
          </div>
        )}
      </div>

      <div className="job-requirements">
        <div className="requirements-header">
          <h2>Job Requirements</h2>
          <button
            className="edit-button"
            onClick={() => setIsEditingRequirements(!isEditingRequirements)}
          >
            {isEditingRequirements ? "Done" : "Edit"}
          </button>
        </div>

        {isEditingRequirements ? (
          <div className="requirements-form">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newSkill.trim()) {
                  setJobRequirements((prev) => ({
                    ...prev,
                    requiredSkills: [...prev.requiredSkills, newSkill.trim()],
                  }));
                  setNewSkill("");
                }
              }}
            >
              <div className="form-group">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Add new skill"
                  className="skill-input"
                />
                <button type="submit" className="add-button">
                  Add Skill
                </button>
              </div>
            </form>
            <div className="skills-list">
              {jobRequirements.requiredSkills.map((skill) => (
                <div key={skill} className="skill-item">
                  <span>{skill}</span>
                  <button
                    onClick={() =>
                      setJobRequirements((prev) => ({
                        ...prev,
                        requiredSkills: prev.requiredSkills.filter(
                          (s) => s !== skill,
                        ),
                      }))
                    }
                    className="remove-button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ul>
            {jobRequirements.requiredSkills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="resume-list">
        <h2>Candidate Matches ({resumes.length})</h2>
        {resumes
          .sort((a, b) => calculateMatch(b) - calculateMatch(a))
          .map((resume) => {
            const matchScore = calculateMatch(resume);
            return (
              <div
                key={resume.name}
                className={`resume-card ${matchScore > 60 ? "high-match" : ""}`}
              >
                <h3>{resume.name}</h3>
                <p>Match Score: {matchScore.toFixed(1)}%</p>
                <p>Confidence: {resume.confidence.toFixed(1)}%</p>
                <p>Skills: {resume.skills.join(", ")}</p>

                {matchScore > 1 && (
                  <>
                    <div className="contact-section">
                      <h4>Contact Information</h4>
                      <div className="contact-details">
                        <p>Email: {resume.contactInfo.email}</p>
                        <p>Phone: {resume.contactInfo.phone}</p>
                      </div>
                    </div>

                    <div className="soft-skills-section">
                      <h4>Soft Skills Analysis</h4>
                      {resume.softSkills && (
                        <div className="soft-skills-scores">
                          <div className="skill-row">
                            <span>Communication:</span>
                            {renderSkillScore(resume.softSkills.communication)}
                          </div>
                          <div className="skill-row">
                            <span>Leadership:</span>
                            {renderSkillScore(resume.softSkills.leadership)}
                          </div>
                          <div className="skill-row">
                            <span>Teamwork:</span>
                            {renderSkillScore(resume.softSkills.teamwork)}
                          </div>
                          <div className="skill-row">
                            <span>Problem Solving:</span>
                            {renderSkillScore(resume.softSkills.problemSolving)}
                          </div>
                          <div className="skill-row">
                            <span>Adaptability:</span>
                            {renderSkillScore(resume.softSkills.adaptability)}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>

      {errors.length > 0 && (
        <div className="error-section">
          <h3>Errors:</h3>
          {errors.map((error, index) => (
            <p key={index} className="error-item">
              {error.fileName}: {error.error}
            </p>
          ))}
        </div>
      )}
    </main>
  );
}

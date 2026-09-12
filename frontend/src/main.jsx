import React, { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, BarChart3, ArrowDownRight, BriefcaseBusiness, Bookmark, Check, ChevronDown, CircleUserRound, FileText, MapPin, Menu, Pencil, Plus, Search, Settings2, Sparkles, Trash2, Users, X } from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const demoJobs = [
  { id: "demo-1", title: "Senior Product Designer", location: "New York, NY", workMode: "HYBRID", employmentType: "FULL_TIME", company: { name: "Juniper Labs" }, skills: ["Figma", "Research", "Systems"], description: "Shape a calm, intelligent workspace for teams building the next generation of climate tools." },
  { id: "demo-2", title: "Frontend Engineer", location: "Remote", workMode: "REMOTE", employmentType: "FULL_TIME", company: { name: "Morrow Health" }, skills: ["React", "TypeScript", "Accessibility"], description: "Build humane care experiences with a small product team that sweats the details." },
  { id: "demo-3", title: "Growth Marketing Lead", location: "Austin, TX", workMode: "ONSITE", employmentType: "FULL_TIME", company: { name: "Field Notes" }, skills: ["Strategy", "Content", "Analytics"], description: "Turn a loved independent publishing platform into a wider creative community." }
];

async function request(path, options = {}) {
  const token = localStorage.getItem("northstar-token");
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function App() {
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState("All work modes");
  const [selectedJob, setSelectedJob] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("northstar-user") || "null"));
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [applications, setApplications] = useState([]);
  const [employerJobs, setEmployerJobs] = useState([]);

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => { if (user) loadDashboard(); else { setDashboard(null); setApplications([]); setEmployerJobs([]); } }, [user]);
  async function loadJobs(search = query, workMode = mode, locationFilter = location) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...(search ? { search } : {}), ...(locationFilter ? { location: locationFilter } : {}), ...(workMode !== "All work modes" ? { workMode } : {}) });
      const data = await request(`/jobs?${params}`);
      setJobs(data.data);
    } catch { setJobs(demoJobs); }
    finally { setLoading(false); }
  }
  function signIn(result) { localStorage.setItem("northstar-token", result.token); localStorage.setItem("northstar-user", JSON.stringify(result.user)); setUser(result.user); setAuthOpen(false); setNotice(`Welcome back, ${result.user.name.split(" ")[0]}.`); }
  async function handleAuth(form) {
    const path = authMode === "login" ? "/auth/login" : "/auth/register";
    const result = await request(path, { method: "POST", body: JSON.stringify(form) });
    signIn(result);
  }
  async function apply(job) {
    if (!user) { setAuthMode("login"); setAuthOpen(true); return; }
    if (user.role !== "CANDIDATE") { setNotice("Only candidate accounts can apply to jobs. Sign in as a candidate to apply."); return; }
    try { await request(`/jobs/${job.id}/apply`, { method: "POST", body: JSON.stringify({}) }); setNotice("Application sent. Good luck out there."); }
    catch (error) { setNotice(error.message); }
  }
  async function save(job) {
    if (!user) { setAuthMode("login"); setAuthOpen(true); return; }
    try { await request(`/jobs/${job.id}/save`, { method: "POST", body: JSON.stringify({}) }); setNotice("Saved to your shortlist."); }
    catch (error) { setNotice(error.message); }
  }
  async function loadDashboard() {
    const requests = [request("/dashboard"), request("/applications")];
    if (user.role === "EMPLOYER" || user.role === "ADMIN") requests.push(request("/employer/jobs"));
    const results = await Promise.allSettled(requests);
    const [summary, applicationData, employerJobData] = results;
    const failures = results.filter((result) => result.status === "rejected");
    if (summary?.status === "fulfilled") setDashboard(summary.value);
    if (applicationData?.status === "fulfilled") setApplications(applicationData.value);
    if (employerJobData?.status === "fulfilled") setEmployerJobs(employerJobData.value);
    if (failures.length) setNotice(failures.map((failure) => failure.reason?.message || "Dashboard request failed").join(" | "));
  }
  async function refreshDashboard() { await loadDashboard(); setNotice("Dashboard refreshed."); }
  async function saveJob(form, id) {
    const payload = { ...form, skills: form.skills.split(",").map((item) => item.trim()).filter(Boolean), benefits: form.benefits.split(",").map((item) => item.trim()).filter(Boolean) };
    await request(id ? `/jobs/${id}` : "/jobs", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    setNotice(id ? "Role updated." : "Role published.");
    await loadDashboard();
  }
  async function changeJobStatus(id, status) { try { await request(`/jobs/${id}`, { method: "PUT", body: JSON.stringify({ status }) }); setNotice(status === "CLOSED" ? "Role closed." : "Role reopened."); await loadDashboard(); } catch (error) { setNotice(error.message); } }
  async function deleteJob(id) { try { await request(`/jobs/${id}`, { method: "DELETE" }); setNotice("Role deleted."); await loadDashboard(); } catch (error) { setNotice(error.message); } }
  async function updateApplicationStatus(id, status) { try { await request(`/applications/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }); setNotice("Application status updated."); await loadDashboard(); } catch (error) { setNotice(error.message); } }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Sparkles size={17} /></span><span>northstar</span></a><nav><a href="#jobs">Explore roles</a><a href="#principles">Our approach</a></nav><div className="top-actions">{user ? <button className="user-chip" onClick={() => { localStorage.clear(); setUser(null); }}><CircleUserRound size={17} />{user.name.split(" ")[0]}<span className="signout">Sign out</span></button> : <><button className="text-button" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>Sign in</button><button className="dark-button small" onClick={() => { setAuthMode("register"); setAuthOpen(true); }}>Join Northstar <ArrowUpRight size={15} /></button></>}</div><button className="menu-button"><Menu size={20} /></button></header>
    <main id="top"><section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot" />A better way to move forward</p><h1>Work that feels<br /><em>worthwhile.</em></h1><p className="hero-text">Northstar brings thoughtful people and ambitious teams together. No noise, no guesswork, just the next right move.</p><div className="hero-stats"><div><strong>12k+</strong><span>open roles</span></div><div><strong>840</strong><span>great companies</span></div><div><strong>91%</strong><span>feel good about it</span></div></div></div><div className="hero-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-card"><span className="art-label">today's signal</span><strong>Make your<br />next chapter<br /><i>count.</i></strong><div className="signal-line"><span /><span /><span /><span /></div></div><div className="art-note"><MapPin size={15} /> Anywhere is a place</div></div></section>
    {user?.role === "ADMIN" && <AdminAnalytics dashboard={dashboard} />}
    {user && <Dashboard user={user} dashboard={dashboard} applications={applications} employerJobs={employerJobs} onRefresh={refreshDashboard} onSaveJob={saveJob} onChangeJobStatus={changeJobStatus} onDeleteJob={deleteJob} onUpdateApplicationStatus={updateApplicationStatus} />}
    <section className="search-section" id="jobs"><div className="section-heading"><div><p className="eyebrow">Curated for momentum</p><h2>Find your next north star</h2></div><span className="result-count">{jobs.length || "—"} roles and counting</span></div><div className="search-bar"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadJobs()} placeholder="Search by role, skill, or company" /><div className="filter location-filter"><MapPin size={17} /><input className="location-input" value={location} onChange={(event) => setLocation(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadJobs()} placeholder="Everywhere" aria-label="Filter by location" /></div><div className="filter"><BriefcaseBusiness size={17} /><select value={mode} onChange={(event) => { setMode(event.target.value); loadJobs(query, event.target.value, location); }}><option>All work modes</option><option>REMOTE</option><option>HYBRID</option><option>ONSITE</option></select></div><button className="search-button" onClick={() => loadJobs()}>Search</button></div>
      <div className="job-layout"><div className="job-list">{loading ? <div className="empty-state">Finding the right signals...</div> : jobs.length ? jobs.map((job, index) => <article className={`job-card ${selectedJob?.id === job.id ? "active" : ""}`} key={job.id} onClick={() => setSelectedJob(job)}><div className="company-avatar">{(job.company?.name || "N").slice(0, 1)}</div><div className="job-content"><div className="job-meta"><span>{job.company?.name || "Independent team"}</span><span>{index < 2 ? "New" : "3d ago"}</span></div><h3>{job.title}</h3><div className="job-details"><span><MapPin size={14} />{job.location}</span><span>{job.workMode}</span></div><div className="skill-row">{(job.skills || []).slice(0, 3).map(skill => <span key={skill}>{skill}</span>)}</div></div><button className="icon-button" aria-label="Save job" onClick={(event) => { event.stopPropagation(); save(job); }}><Bookmark size={18} /></button></article>) : <div className="empty-state"><strong>No roles found.</strong><span>Try a broader search or check back soon.</span></div>}</div><JobPreview job={selectedJob || jobs[0]} onApply={apply} onSave={save} /></div></section>
    <section className="principles" id="principles"><div><p className="eyebrow">Why Northstar</p><h2>Less searching.<br /><em>More becoming.</em></h2></div><div className="principle-grid"><div><span>01</span><h3>Human signals</h3><p>We look beyond keywords to match the shape of how you think, make, and grow.</p></div><div><span>02</span><h3>Good work, clearly</h3><p>Every role gets the context you need to decide if the work belongs in your story.</p></div><div><span>03</span><h3>Your pace, your path</h3><p>Save what sparks something. Apply when it feels right. There is no race here.</p></div></div></section></main>
    {notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}
    {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setAuthOpen(false)} onSubmit={handleAuth} />}
  </div>;
}

function JobPreview({ job, onApply, onSave }) { if (!job) return <aside className="preview empty-state">Select a role to see the details.</aside>; return <aside className="preview"><div className="preview-top"><div className="large-avatar">{(job.company?.name || "N").slice(0, 1)}</div><button className="icon-button"><Bookmark size={19} /></button></div><p className="eyebrow">{job.company?.name || "Independent team"}</p><h2>{job.title}</h2><div className="preview-details"><span><MapPin size={15} />{job.location}</span><span><BriefcaseBusiness size={15} />{job.workMode} · {job.employmentType?.replace("_", " ")}</span></div><p className="preview-description">{job.description}</p><div className="preview-actions"><button className="dark-button" onClick={() => onApply(job)}>Apply for this role <ArrowUpRight size={16} /></button><button className="save-button" onClick={() => onSave(job)}><Bookmark size={16} /> Save</button></div><div className="preview-note"><Sparkles size={16} /><span>Northstar note<br /><strong>This role has a clear path to impact.</strong></span></div></aside> }

function AdminAnalytics({ dashboard }) { const groups = [["Top skills", dashboard?.topSkills || []], ["Top companies", dashboard?.topCompanies || []], ["Top locations", dashboard?.topLocations || []]]; return <section className="analytics-section"><div className="analytics-heading"><div><p className="eyebrow"><span className="eyebrow-dot" />Marketplace signals</p><h2>What is moving the market</h2></div><BarChart3 size={20} /></div><div className="analytics-grid">{groups.map(([title, items]) => <div className="analytics-card" key={title}><h3>{title}</h3>{items.length ? items.map((item, index) => <div className="rank-row" key={item.name}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><em>{item.count}</em></div>) : <p className="analytics-empty">No data yet</p>}</div>)}</div></section>; }

function Dashboard({ user, dashboard, applications, employerJobs, onRefresh, onSaveJob, onChangeJobStatus, onDeleteJob, onUpdateApplicationStatus }) {
  const isAdmin = user.role === "ADMIN";
  const isEmployer = user.role === "EMPLOYER";
  const title = isAdmin ? "Platform pulse" : isEmployer ? "Your hiring desk" : "Your journey";
  const subtitle = isAdmin ? "A clear view of the marketplace." : isEmployer ? "Keep the right people moving." : "The roles and signals you have saved along the way.";
  const cards = isAdmin ? [["Users", dashboard?.users, Users], ["Open roles", dashboard?.jobs, BriefcaseBusiness], ["Companies", dashboard?.companies, BarChart3], ["Applications", dashboard?.applications, FileText], ["Scraped today", dashboard?.scrapedToday, ArrowDownRight]] : isEmployer ? [["Published roles", dashboard?.jobs, BriefcaseBusiness], ["Applications", dashboard?.applications, Users], ["Response rate", "—", BarChart3]] : [["Applications", dashboard?.applications, FileText], ["Saved roles", dashboard?.savedJobs, Bookmark], ["Profile signal", "Fresh", Sparkles]];
  return <section className="dashboard-section" id="dashboard"><div className="dashboard-heading"><div><p className="eyebrow"><span className="eyebrow-dot" />{user.role.toLowerCase()} dashboard</p><h2>{title}</h2><p>{subtitle}</p></div><button className="refresh-button" onClick={onRefresh}><Settings2 size={15} /> Refresh</button></div><div className="metric-grid">{cards.map(([label, value, Icon]) => <div className="metric-card" key={label}><div className="metric-icon"><Icon size={17} /></div><span>{label}</span><strong>{dashboard ? value : "..."}</strong><small><ArrowUpRight size={12} /> Live from Northstar</small></div>)}</div>{isEmployer && <EmployerJobManager jobs={employerJobs} onSave={onSaveJob} onChangeStatus={onChangeJobStatus} onDelete={onDeleteJob} />}<div className="activity-panel"><div className="activity-heading"><div><p className="eyebrow">Recent movement</p><h3>{isEmployer ? "Applicants to review" : "Your latest applications"}</h3></div><span>{applications.length} total</span></div>{applications.length ? <div className="application-list">{applications.slice(0, 5).map((application) => <div className="application-row" key={application.id}><div className="application-avatar">{(application.job?.company?.name || "N").slice(0, 1)}</div><div><strong>{application.candidate?.name || "Candidate"}</strong><span>{application.job?.title || "Role"} · {application.candidate?.email || "Candidate details"}</span></div>{isEmployer ? <select className="application-status" value={application.status} onChange={(event) => onUpdateApplicationStatus(application.id, event.target.value)}><option value="APPLIED">Applied</option><option value="REVIEWING">Reviewing</option><option value="SHORTLISTED">Shortlisted</option><option value="REJECTED">Rejected</option><option value="HIRED">Hired</option></select> : <em className={`status-${application.status.toLowerCase()}`}>{application.status.toLowerCase()}</em>}</div>)}</div> : <div className="dashboard-empty"><Sparkles size={18} /><span>No applications yet. The right opportunity is still out there.</span><a href="#jobs">Explore roles <ArrowUpRight size={13} /></a></div>}</div></section>;
}

function EmployerJobManager({ jobs, onSave, onChangeStatus, onDelete }) {
  const emptyForm = { title: "", location: "", workMode: "REMOTE", employmentType: "FULL_TIME", skills: "", benefits: "", description: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  function edit(job) { setEditingId(job.id); setForm({ title: job.title, location: job.location, workMode: job.workMode, employmentType: job.employmentType, skills: (job.skills || []).join(", "), benefits: (job.benefits || []).join(", "), description: job.description }); setOpen(true); }
  async function submit(event) { event.preventDefault(); setError(""); try { await onSave(form, editingId); setForm(emptyForm); setEditingId(null); setOpen(false); } catch (submissionError) { setError(submissionError.message); } }
  return <div className="employer-manager"><div className="manager-heading"><div><p className="eyebrow">Hiring workspace</p><h3>Your roles</h3></div><button className="dark-button small" onClick={() => { setEditingId(null); setForm(emptyForm); setOpen(!open); }}><Plus size={15} /> New role</button></div>{open && <form className="job-form" onSubmit={submit}><div className="form-grid"><input required placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input required placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /><select value={form.workMode} onChange={(e) => setForm({ ...form, workMode: e.target.value })}><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option><option value="ONSITE">On-site</option></select><select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="INTERNSHIP">Internship</option></select><input placeholder="Skills, comma separated" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /><input placeholder="Benefits, comma separated" value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} /></div><textarea required placeholder="Describe the role" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><div className="form-actions"><button className="dark-button small" type="submit">{editingId ? "Save changes" : "Publish role"} <ArrowUpRight size={14} /></button><button className="cancel-button" type="button" onClick={() => setOpen(false)}>Cancel</button></div>{error && <p className="form-error">{error}</p>}</form>}<div className="managed-jobs">{jobs.length ? jobs.map((job) => <div className="managed-job" key={job.id}><div><strong>{job.title}</strong><span>{job.location} · {job.workMode} · {job._count?.applications || 0} applicants</span></div><em className={`job-status-${job.status.toLowerCase()}`}>{job.status.toLowerCase()}</em><button className="icon-button" title="Edit role" onClick={() => edit(job)}><Pencil size={15} /></button>{job.status === "OPEN" ? <button className="icon-button" title="Close role" onClick={() => onChangeStatus(job.id, "CLOSED")}><X size={16} /></button> : <button className="icon-button" title="Reopen role" onClick={() => onChangeStatus(job.id, "OPEN")}><ArrowUpRight size={16} /></button>}<button className="icon-button danger" title="Delete role" onClick={() => onDelete(job.id)}><Trash2 size={15} /></button></div>) : <div className="dashboard-empty"><BriefcaseBusiness size={18} /><span>No roles published yet. Create your first role above.</span></div>}</div></div>;
}

function AuthModal({ mode, setMode, onClose, onSubmit }) { const [form, setForm] = useState({ name: "", email: "", password: "", role: "CANDIDATE", companyName: "" }); const [error, setError] = useState(""); async function submit(event) { event.preventDefault(); setError(""); try { await onSubmit(form); } catch (err) { setError(err.message); } } return <div className="modal-backdrop" onClick={onClose}><div className="auth-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={19} /></button><p className="eyebrow">{mode === "login" ? "Welcome back" : "Start here"}</p><h2>{mode === "login" ? "Find your way in." : "Make room for good work."}</h2><p className="modal-copy">{mode === "login" ? "Your shortlist is waiting." : "Create a free Northstar profile in less than a minute."}</p><form onSubmit={submit}>{mode === "register" && <input required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}<input required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required minLength="8" type="password" placeholder="Password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />{mode === "register" && <><div className="role-toggle"><button type="button" className={form.role === "CANDIDATE" ? "selected" : ""} onClick={() => setForm({ ...form, role: "CANDIDATE" })}>I’m looking for work</button><button type="button" className={form.role === "EMPLOYER" ? "selected" : ""} onClick={() => setForm({ ...form, role: "EMPLOYER" })}>I’m hiring</button></div>{form.role === "EMPLOYER" && <input required placeholder="Company name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />}</>} {error && <p className="form-error">{error}</p>}<button className="dark-button full" type="submit">{mode === "login" ? "Sign in" : "Create account"} <ArrowUpRight size={16} /></button></form><button className="switch-auth" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "New to Northstar? Create an account" : "Already have an account? Sign in"}</button></div></div> }

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);

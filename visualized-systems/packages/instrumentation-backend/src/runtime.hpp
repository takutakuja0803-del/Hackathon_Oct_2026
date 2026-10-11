#pragma once

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <cstdint>
#include <cstdlib>
#include <iomanip>

namespace vgdb {

struct ArrayElemRecord {
    std::string name;
    uintptr_t address;
    size_t size_bytes;
    int64_t scalar_value;
};

struct VarRecord {
    std::string name;
    std::string type;
    std::string role;
    uintptr_t address;
    size_t size_bytes;
    bool is_pointer;
    uintptr_t pointer_target_addr;
    bool is_null;
    bool is_reference;
    std::string ref_target_name;
    bool is_array;
    size_t array_extent;
    std::vector<ArrayElemRecord> array_elements;
    bool has_scalar;
    int64_t scalar_value;
};

struct FrameRecord {
    std::string id;
    std::string function_name;
    int location_line;
    std::vector<VarRecord> variables;
};

struct StepRecord {
    int index;
    int line;
    std::string description;
    std::vector<FrameRecord> frames;
};

class Tracer {
public:
    static Tracer& instance() {
        static Tracer t;
        return t;
    }

    void push_frame(const std::string& name, int line, const std::vector<VarRecord>& vars) {
        std::stringstream ss;
        ss << "frame-" << name << "-" << frame_counter++;
        call_stack.push_back({ss.str(), name, line, vars});
    }

    void pop_frame() {
        if (!call_stack.empty()) {
            call_stack.pop_back();
        }
    }

    void update_current_frame(int line, const std::vector<VarRecord>& vars) {
        if (!call_stack.empty()) {
            call_stack.back().location_line = line;
            call_stack.back().variables = vars;
        }
    }

    void add_step(int line, const std::string& desc, const std::vector<VarRecord>& current_frame_vars) {
        update_current_frame(line, current_frame_vars);
        // Frames are ordered innermost-first (reverse of call_stack)
        std::vector<FrameRecord> snapshot_frames;
        for (auto it = call_stack.rbegin(); it != call_stack.rend(); ++it) {
            snapshot_frames.push_back(*it);
        }
        steps.push_back({(int)steps.size(), line, desc, snapshot_frames});
    }

    void dump() {
        if (dumped) return;
        dumped = true;

        const char* outfile = std::getenv("VGDB_OUTPUT_FILE");
        if (outfile && std::string(outfile).length() > 0) {
            std::ofstream fs(outfile);
            if (fs.is_open()) {
                dump_json(fs);
                fs.close();
                return;
            }
        }
        dump_json(std::cout);
    }

    ~Tracer() {
        dump();
    }

private:
    Tracer() : dumped(false), frame_counter(0) {}
    bool dumped;
    int frame_counter;
    std::vector<FrameRecord> call_stack;
    std::vector<StepRecord> steps;

    static std::string to_hex_addr(uintptr_t addr) {
        std::stringstream ss;
        ss << "0x" << std::hex << addr;
        return ss.str();
    }

    void dump_json(std::ostream& out) {
        out << "[\n";
        for (size_t i = 0; i < steps.size(); ++i) {
            const auto& s = steps[i];
            out << "  {\n";
            out << "    \"index\": " << s.index << ",\n";
            out << "    \"line\": " << s.line << ",\n";
            out << "    \"description\": \"" << escape_json(s.description) << "\",\n";
            out << "    \"frames\": [\n";
            for (size_t fi = 0; fi < s.frames.size(); ++fi) {
                const auto& f = s.frames[fi];
                out << "      {\n";
                out << "        \"id\": \"" << escape_json(f.id) << "\",\n";
                out << "        \"functionName\": \"" << escape_json(f.function_name) << "\",\n";
                out << "        \"locationLine\": " << f.location_line << ",\n";
                out << "        \"variables\": [\n";
                for (size_t j = 0; j < f.variables.size(); ++j) {
                    const auto& v = f.variables[j];
                    out << "          {\n";
                    out << "            \"name\": \"" << escape_json(v.name) << "\",\n";
                    out << "            \"type\": \"" << escape_json(v.type) << "\",\n";
                    out << "            \"role\": \"" << escape_json(v.role) << "\",\n";
                    out << "            \"address\": \"" << to_hex_addr(v.address) << "\",\n";
                    out << "            \"sizeBytes\": " << v.size_bytes << ",\n";
                    out << "            \"isPointer\": " << (v.is_pointer ? "true" : "false") << ",\n";
                    if (v.is_pointer) {
                        out << "            \"pointerValue\": \"" << (v.is_null ? "0x0" : to_hex_addr(v.pointer_target_addr)) << "\",\n";
                        out << "            \"isNull\": " << (v.is_null ? "true" : "false") << ",\n";
                    }
                    out << "            \"isReference\": " << (v.is_reference ? "true" : "false") << ",\n";
                    if (v.is_reference) {
                        out << "            \"refTargetName\": \"" << escape_json(v.ref_target_name) << "\",\n";
                    }
                    out << "            \"isArray\": " << (v.is_array ? "true" : "false") << ",\n";
                    if (v.is_array) {
                        out << "            \"arrayExtent\": " << v.array_extent << ",\n";
                        out << "            \"arrayElements\": [\n";
                        for (size_t ei = 0; ei < v.array_elements.size(); ++ei) {
                            const auto& elem = v.array_elements[ei];
                            out << "              {\n";
                            out << "                \"name\": \"" << escape_json(elem.name) << "\",\n";
                            out << "                \"address\": \"" << to_hex_addr(elem.address) << "\",\n";
                            out << "                \"sizeBytes\": " << elem.size_bytes << ",\n";
                            out << "                \"scalarValue\": " << elem.scalar_value << "\n";
                            out << "              }" << (ei + 1 < v.array_elements.size() ? "," : "") << "\n";
                        }
                        out << "            ],\n";
                    }
                    out << "            \"hasScalar\": " << (v.has_scalar ? "true" : "false");
                    if (v.has_scalar) {
                        out << ",\n            \"scalarValue\": " << v.scalar_value << "\n";
                    } else {
                        out << "\n";
                    }
                    out << "          }" << (j + 1 < f.variables.size() ? "," : "") << "\n";
                }
                out << "        ]\n";
                out << "      }" << (fi + 1 < s.frames.size() ? "," : "") << "\n";
            }
            out << "    ]\n";
            out << "  }" << (i + 1 < steps.size() ? "," : "") << "\n";
        }
        out << "]\n";
    }

    static std::string escape_json(const std::string& s) {
        std::string res;
        for (char c : s) {
            if (c == '"') res += "\\\"";
            else if (c == '\\') res += "\\\\";
            else if (c == '\n') res += "\\n";
            else if (c == '\r') res += "\\r";
            else if (c == '\t') res += "\\t";
            else res += c;
        }
        return res;
    }
};

// RAII guard for process exit
struct TracerGuard {
    ~TracerGuard() {
        Tracer::instance().dump();
    }
};

// Helper overloads to record variables
inline VarRecord make_var(const std::string& name, const std::string& type, const std::string& role, int& val) {
    VarRecord r{};
    r.name = name; r.type = type; r.role = role; r.address = (uintptr_t)&val; r.size_bytes = sizeof(val);
    r.is_pointer = false; r.is_reference = false; r.is_array = false;
    r.has_scalar = true; r.scalar_value = (int64_t)val;
    return r;
}

inline VarRecord make_var(const std::string& name, const std::string& type, const std::string& role, const int& val) {
    VarRecord r{};
    r.name = name; r.type = type; r.role = role; r.address = (uintptr_t)&val; r.size_bytes = sizeof(val);
    r.is_pointer = false; r.is_reference = false; r.is_array = false;
    r.has_scalar = true; r.scalar_value = (int64_t)val;
    return r;
}

inline VarRecord make_var(const std::string& name, const std::string& type, const std::string& role, int*& val) {
    bool is_null = (val == nullptr);
    uintptr_t target = is_null ? 0 : (uintptr_t)val;
    VarRecord r{};
    r.name = name; r.type = type; r.role = role; r.address = (uintptr_t)&val; r.size_bytes = sizeof(val);
    r.is_pointer = true; r.pointer_target_addr = target; r.is_null = is_null;
    r.is_reference = false; r.is_array = false; r.has_scalar = false; r.scalar_value = 0;
    return r;
}

inline VarRecord make_var(const std::string& name, const std::string& type, const std::string& role, int* const& val) {
    bool is_null = (val == nullptr);
    uintptr_t target = is_null ? 0 : (uintptr_t)val;
    VarRecord r{};
    r.name = name; r.type = type; r.role = role; r.address = (uintptr_t)&val; r.size_bytes = sizeof(val);
    r.is_pointer = true; r.pointer_target_addr = target; r.is_null = is_null;
    r.is_reference = false; r.is_array = false; r.has_scalar = false; r.scalar_value = 0;
    return r;
}

inline VarRecord make_var_ref(const std::string& name, const std::string& type, const std::string& role, int& val, const std::string& target_name) {
    VarRecord r{};
    r.name = name; r.type = type; r.role = role; r.address = (uintptr_t)&val; r.size_bytes = sizeof(val);
    r.is_pointer = false; r.is_reference = true; r.ref_target_name = target_name;
    r.is_array = false; r.has_scalar = true; r.scalar_value = (int64_t)val;
    return r;
}

inline VarRecord make_var_array(const std::string& name, const std::string& type, const std::string& role, int* arr, size_t extent) {
    VarRecord r{};
    r.name = name; r.type = type; r.role = role; r.address = (uintptr_t)arr; r.size_bytes = sizeof(int) * extent;
    r.is_pointer = false; r.is_reference = false; r.is_array = true;
    r.array_extent = extent; r.has_scalar = false; r.scalar_value = 0;
    for (size_t i = 0; i < extent; ++i) {
        std::stringstream ss; ss << "[" << i << "]";
        r.array_elements.push_back({ss.str(), (uintptr_t)&arr[i], sizeof(int), (int64_t)arr[i]});
    }
    return r;
}

} // namespace vgdb

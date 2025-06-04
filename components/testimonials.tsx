"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useInView } from "react-intersection-observer"
import { Card, CardContent } from "@/components/ui/card"
import { Quote } from "lucide-react"

export function Testimonials() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  const [activeIndex, setActiveIndex] = useState(0)

  const testimonials = [
    {
      name: "Sarah Johnson",
      position: "CTO, TechStart Inc.",
      image: "/placeholder.svg?height=100&width=100",
      quote:
        "Working with this developer was a game-changer for our company. Their expertise in full-stack development helped us launch our platform in record time. The code quality and attention to detail were exceptional.",
    },
    {
      name: "Michael Chen",
      position: "Product Manager, InnovateCorp",
      image: "/placeholder.svg?height=100&width=100",
      quote:
        "I've worked with many developers, but few have the combination of technical skills and communication abilities that this developer possesses. They not only delivered a high-quality product but also provided valuable insights that improved our overall design.",
    },
    {
      name: "Emily Rodriguez",
      position: "Founder, StartupBoost",
      image: "/placeholder.svg?height=100&width=100",
      quote:
        "The DevOps expertise this developer brought to our team transformed our deployment process. We went from manual, error-prone deployments to a fully automated CI/CD pipeline that saved us countless hours and improved our reliability.",
    },
    {
      name: "David Kim",
      position: "Lead Developer, Enterprise Solutions",
      image: "/placeholder.svg?height=100&width=100",
      quote:
        "Their knowledge of both frontend and backend technologies made them an invaluable asset to our project. They seamlessly integrated with our team and consistently delivered high-quality code ahead of schedule.",
    },
  ]

  useEffect(() => {
    if (!inView) return
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1))
    }, 5000)
    return () => clearInterval(interval)
  }, [inView, testimonials.length])

  const handleDotClick = (index: number) => {
    setActiveIndex(index)
  }

  return (
    <section id="testimonials" className="py-24 bg-white dark:bg-gray-950 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-gray-50 to-transparent dark:from-gray-900 dark:to-transparent"></div>
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-100 dark:bg-violet-900/20 rounded-full blur-3xl opacity-50"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">Client Testimonials</h2>
          <div className="w-24 h-1.5 bg-gradient-to-r from-blue-600 to-violet-600 mx-auto mb-8 rounded-full"></div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            What clients and colleagues have to say about working with me
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-3xl shadow-2xl">
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {testimonials.map((testimonial, index) => (
                <div key={index} className="w-full flex-shrink-0">
                  <Card className="border-0 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 overflow-hidden rounded-none h-full">
                    <CardContent className="p-10 md:p-16">
                      <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
                        <div className="flex-shrink-0">
                          <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-full blur opacity-75"></div>
                            <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-gray-800">
                              <img
                                src={testimonial.image || "/placeholder.svg"}
                                alt={testimonial.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                          <Quote className="h-16 w-16 text-blue-600/20 dark:text-blue-400/20 mb-6 mx-auto md:mx-0" />
                          <p className="text-xl text-gray-700 dark:text-gray-300 italic mb-8 leading-relaxed">
                            {testimonial.quote}
                          </p>
                          <div>
                            <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                              {testimonial.name}
                            </h4>
                            <p className="text-lg text-blue-600 dark:text-blue-400">{testimonial.position}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center mt-10">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-4 h-4 mx-2 rounded-full transition-all duration-300 ${
                  activeIndex === index
                    ? "bg-gradient-to-r from-blue-600 to-violet-600 scale-125"
                    : "bg-gray-300 dark:bg-gray-700"
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              ></button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
